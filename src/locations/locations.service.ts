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
import { deleteExternalIdentifiers } from '../external-identifiers/external-identifier-cleanup.js';
import type {
  CreateLocationDto,
  UpdateLocationDto,
} from './dto/location.dto.js';

@Injectable()
export class LocationsService {
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
    const rows = await this.prisma.location.findMany({
      where: { library: { organizationId: context.organizationId } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { library: true },
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
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { library: true },
    });
    if (!location) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: location.library.organizationId,
    });
    return location;
  }

  async create(
    userId: string,
    input: CreateLocationDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const library = await this.prisma.library.findUnique({
      where: { id: input.libraryId },
    });
    if (!library) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: library.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.location.create({
      data: { libraryId: library.id, name: normalizeName(input.name) },
      include: { library: true },
    });
  }

  async update(
    id: string,
    userId: string,
    input: UpdateLocationDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { library: true },
    });
    if (!location) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: location.library.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    if (input.name === undefined) return location;
    return this.prisma.location.update({
      where: { id },
      data: { name: normalizeName(input.name) },
      include: { library: true },
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { library: true },
    });
    if (!location) throw resourceNotFound();
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: location.library.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.$transaction(async (tx) => {
      const holding = await tx.holding.findFirst({
        where: { locationId: id },
        select: { id: true },
      });
      if (holding) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          API_ERROR_CODES.FOREIGN_KEY_CONFLICT,
          'The operation violates a related resource reference.',
        );
      }

      await deleteExternalIdentifiers(tx, 'Location', [id]);
      return tx.location.delete({ where: { id } });
    });
  }
}

function normalizeName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      API_ERROR_CODES.INVALID_REQUEST_DATA,
      'Location name must not be empty.',
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
