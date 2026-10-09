import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import {
  OrganizationContextResolver,
  parseOrganizationContextHeader,
} from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLibraryDto, UpdateLibraryDto } from './dto/library.dto.js';

@Injectable()
export class LibrariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async findAll(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: PaginationInput = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.library.findMany({
      where: { organizationId: context.organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const library = await this.prisma.library.findUnique({ where: { id } });
    if (!library) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: library.organizationId,
    });
    return library;
  }

  async create(
    userId: string,
    headerValue: OrganizationHeaderValue,
    input: CreateLibraryDto,
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.library.create({
      data: {
        organizationId: context.organizationId,
        name: normalizeName(input.name),
      },
    });
  }

  async update(
    id: string,
    userId: string,
    input: UpdateLibraryDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const library = await this.prisma.library.findUnique({ where: { id } });
    if (!library) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: library.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    if (input.name === undefined) return library;
    return this.prisma.library.update({
      where: { id },
      data: { name: normalizeName(input.name) },
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const library = await this.prisma.library.findUnique({ where: { id } });
    if (!library) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: library.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.$transaction(async (tx) => {
      await tx.externalIdentifier.deleteMany({
        where: { entityType: 'Library', entityId: id },
      });
      return tx.library.delete({ where: { id } });
    });
  }
}

function normalizeName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      API_ERROR_CODES.INVALID_REQUEST_DATA,
      'Library name must not be empty.',
    );
  }
  return name;
}

function resourceNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    'The requested resource was not found.',
  );
}
