import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationRole } from '@prisma/client';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';

export interface ExternalIdentifierInput {
  type: string;
  value: string;
  source?: string | null;
  editionId: string;
}

export type ExternalIdentifierUpdateInput = Partial<
  Omit<ExternalIdentifierInput, 'editionId'>
>;

type ExternalIdentifierWithOwnership = {
  id: string;
  type: string;
  value: string;
  source: string | null;
  editionId: string;
  edition: { id: string; work: { organizationId: string } };
};

@Injectable()
export class ExternalIdentifiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async findAll(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: PaginationInput & { editionId?: string } = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.externalIdentifier.findMany({
      where: {
        edition: {
          work: { organizationId: context.organizationId },
        },
        ...(query.editionId ? { editionId: query.editionId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async create(
    userId: string,
    data: ExternalIdentifierInput,
    headerValue?: OrganizationHeaderValue,
  ) {
    const edition = await this.requireEdition(data.editionId);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    try {
      return await this.prisma.externalIdentifier.create({
        data: {
          type: data.type,
          value: data.value,
          source: data.source,
          editionId: edition.id,
        },
      });
    } catch (error: unknown) {
      throw this.mapUniqueViolation(error, data.type, data.value);
    }
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const identifier = await this.requireIdentifier(id);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: identifier.edition.work.organizationId,
    });
    return identifier;
  }

  async update(
    id: string,
    userId: string,
    data: ExternalIdentifierUpdateInput,
    headerValue?: OrganizationHeaderValue,
  ) {
    const identifier = await this.requireIdentifier(id);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: identifier.edition.work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    try {
      return await this.prisma.externalIdentifier.update({
        where: { id },
        data,
      });
    } catch (error: unknown) {
      throw this.mapUniqueViolation(
        error,
        data.type ?? identifier.type,
        data.value ?? identifier.value,
      );
    }
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const identifier = await this.requireIdentifier(id);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: identifier.edition.work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.externalIdentifier.delete({ where: { id } });
  }

  private async requireEdition(editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw resourceNotFound('Edition');
    return edition;
  }

  private async requireIdentifier(
    id: string,
  ): Promise<ExternalIdentifierWithOwnership> {
    const identifier = await this.prisma.externalIdentifier.findUnique({
      where: { id },
      include: { edition: { include: { work: true } } },
    });
    if (!identifier) throw resourceNotFound('External identifier');
    return identifier;
  }

  private mapUniqueViolation(error: unknown, type: string, value: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        `External identifier ${type}:${value} already exists`,
      );
    }
    return error;
  }
}

function resourceNotFound(resource: string): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} not found.`,
  );
}
