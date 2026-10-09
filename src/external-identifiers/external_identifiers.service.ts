import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationRole } from '@prisma/client';
import {
  OrganizationContextResolver,
  parseOrganizationContextHeader,
} from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { requireHoldingOrganization } from '../holdings/holding-ownership.js';
import type {
  CreateExternalIdentifierDto,
  ExternalIdentifierListQueryDto,
  UpdateExternalIdentifierDto,
} from './dto/external-identifier.dto.js';

export type ExternalIdentifierEntityType =
  'Work' | 'Edition' | 'Library' | 'Location' | 'Holding' | 'Item';

export const EXTERNAL_IDENTIFIER_ENTITY_TYPES: ExternalIdentifierEntityType[] =
  ['Work', 'Edition', 'Library', 'Location', 'Holding', 'Item'];

type EntityOrganizations = {
  organizationId: string;
  relatedOrganizationId?: string;
  holding?: {
    edition: { work: { organizationId: string } };
    location: { library: { organizationId: string } };
  };
};

@Injectable()
export class ExternalIdentifiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async list(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: Partial<ExternalIdentifierListQueryDto> & PaginationInput = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.externalIdentifier.findMany({
      where: {
        organizationId: context.organizationId,
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.authority ? { authority: query.authority } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async create(
    userId: string,
    data: CreateExternalIdentifierDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    validateIdentifier(data.authority, data.value);
    const entity = await this.resolveEntity(data.entityType, data.entityId);
    await this.resolveEntityContext(
      userId,
      headerValue,
      entity,
      OrganizationRole.STAFF,
    );
    try {
      return await this.prisma.externalIdentifier.create({
        data: {
          entityType: data.entityType,
          entityId: data.entityId,
          authority: data.authority,
          value: data.value,
          organizationId: entity.organizationId,
        },
      });
    } catch (error: unknown) {
      throw mapUniqueViolation(error, data.authority, data.value);
    }
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const identifier = await this.requireIdentifier(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: identifier.organizationId,
    });
    return identifier;
  }

  async update(
    id: string,
    userId: string,
    data: UpdateExternalIdentifierDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const identifier = await this.requireIdentifier(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: identifier.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    if (data.authority !== undefined) {
      validateIdentifier(data.authority, data.value ?? identifier.value);
    } else if (data.value !== undefined && !data.value.trim()) {
      throw invalidRequestData('The External Identifier value is invalid.');
    }
    try {
      return await this.prisma.externalIdentifier.update({
        where: { id },
        data,
      });
    } catch (error: unknown) {
      throw mapUniqueViolation(
        error,
        data.authority ?? identifier.authority,
        data.value ?? identifier.value,
      );
    }
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const identifier = await this.requireIdentifier(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: identifier.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.externalIdentifier.delete({ where: { id } });
  }

  private async resolveEntityContext(
    userId: string,
    headerValue: OrganizationHeaderValue | undefined,
    entity: EntityOrganizations,
    requiredRole?: OrganizationRole,
  ) {
    if (entity.relatedOrganizationId && entity.holding) {
      const contexts = await this.contexts.resolveDerivedParentPairContext({
        userId,
        headerValue,
        firstOrganizationId: entity.organizationId,
        secondOrganizationId: entity.relatedOrganizationId,
      });
      requireHoldingOrganization(entity.holding);
      if (requiredRole) this.contexts.requireRole(contexts.first, requiredRole);
      return contexts.first;
    }
    return this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: entity.organizationId,
      requiredRole,
    });
  }

  private async resolveEntity(
    entityType: string,
    entityId: string,
  ): Promise<EntityOrganizations> {
    switch (entityType) {
      case 'Work': {
        const row = await this.prisma.work.findUnique({
          where: { id: entityId },
          select: { organizationId: true },
        });
        if (!row) throw resourceNotFound();
        return row;
      }
      case 'Edition': {
        const row = await this.prisma.edition.findUnique({
          where: { id: entityId },
          select: { work: { select: { organizationId: true } } },
        });
        if (!row) throw resourceNotFound();
        return { organizationId: row.work.organizationId };
      }
      case 'Library': {
        const row = await this.prisma.library.findUnique({
          where: { id: entityId },
          select: { organizationId: true },
        });
        if (!row) throw resourceNotFound();
        return row;
      }
      case 'Location': {
        const row = await this.prisma.location.findUnique({
          where: { id: entityId },
          select: { library: { select: { organizationId: true } } },
        });
        if (!row) throw resourceNotFound();
        return { organizationId: row.library.organizationId };
      }
      case 'Holding': {
        const row = await this.prisma.holding.findUnique({
          where: { id: entityId },
          select: holdingOrganizationSelect,
        });
        if (!row) throw resourceNotFound();
        const holding = holdingOwnership(row);
        return {
          organizationId: row.edition.work.organizationId,
          relatedOrganizationId: row.location.library.organizationId,
          holding,
        };
      }
      case 'Item': {
        const row = await this.prisma.item.findUnique({
          where: { id: entityId },
          select: { holding: { select: holdingOrganizationSelect } },
        });
        if (!row) throw resourceNotFound();
        const holding = holdingOwnership(row.holding);
        return {
          organizationId: row.holding.edition.work.organizationId,
          relatedOrganizationId: row.holding.location.library.organizationId,
          holding,
        };
      }
      default:
        throw invalidRequestData(
          'The External Identifier entity type is invalid.',
        );
    }
  }

  private async requireIdentifier(id: string) {
    const identifier = await this.prisma.externalIdentifier.findUnique({
      where: { id },
    });
    if (!identifier) throw resourceNotFound();
    return identifier;
  }
}

const holdingOrganizationSelect = {
  edition: { select: { work: { select: { organizationId: true } } } },
  location: { select: { library: { select: { organizationId: true } } } },
} as const;

function holdingOwnership(holding: {
  edition: { work: { organizationId: string } };
  location: { library: { organizationId: string } };
}) {
  return holding;
}

function validateIdentifier(authority: string, value: string): void {
  if (typeof authority !== 'string' || !authority.trim()) {
    throw invalidRequestData('The External Identifier authority is invalid.');
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidRequestData('The External Identifier value is invalid.');
  }
}

function invalidRequestData(message: string): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    API_ERROR_CODES.INVALID_REQUEST_DATA,
    message,
  );
}

function resourceNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    'The requested resource was not found.',
  );
}

function mapUniqueViolation(error: unknown, authority: string, value: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ApiException(
      HttpStatus.CONFLICT,
      API_ERROR_CODES.DUPLICATE_EXTERNAL_IDENTIFIER,
      `External identifier ${authority}:${value} already exists for this entity.`,
    );
  }
  return error;
}
