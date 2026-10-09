import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
import { requireHoldingOrganization } from '../holdings/holding-ownership.js';

export interface CreateItemInput {
  label?: string | null;
  status?: string;
  notes?: string | null;
  holdingId: string;
}

export type UpdateItemInput = Omit<Partial<CreateItemInput>, 'holdingId'>;

const itemRelations = {
  holding: {
    include: {
      edition: { include: { work: { include: { organization: true } } } },
      location: { include: { library: { include: { organization: true } } } },
    },
  },
};

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async findAllByUser(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: PaginationInput = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.item.findMany({
      where: {
        holding: {
          edition: { work: { organizationId: context.organizationId } },
          location: { library: { organizationId: context.organizationId } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: itemRelations,
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
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: itemRelations,
    });
    if (!item) throw resourceNotFound();
    await this.resolveItemOrganization(userId, headerValue, item.holding);
    return item;
  }

  async create(
    userId: string,
    data: CreateItemInput,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const holding = await this.requireWritableHolding(
      data.holdingId,
      userId,
      headerValue,
    );
    validateStatus(data.status);
    return this.prisma.item.create({
      data: {
        label: data.label,
        status: data.status ?? undefined,
        notes: data.notes,
        holdingId: holding.id,
      },
      include: itemRelations,
    });
  }

  async update(
    id: string,
    userId: string,
    data: UpdateItemInput,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const item = await this.requireItem(id);
    await this.resolveItemOrganization(
      userId,
      headerValue,
      item.holding,
      OrganizationRole.STAFF,
    );
    validateStatus(data.status);
    return this.prisma.item.update({
      where: { id },
      data: {
        label: data.label,
        status: data.status ?? undefined,
        notes: data.notes,
      },
      include: itemRelations,
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const item = await this.requireItem(id);
    await this.resolveItemOrganization(
      userId,
      headerValue,
      item.holding,
      OrganizationRole.STAFF,
    );
    return this.prisma.$transaction(async (tx) => {
      await tx.externalIdentifier.deleteMany({
        where: { entityType: 'Item', entityId: id },
      });
      return tx.item.delete({ where: { id }, include: itemRelations });
    });
  }

  private async requireItem(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: itemRelations,
    });
    if (!item) throw resourceNotFound();
    return item;
  }

  private async requireWritableHolding(
    holdingId: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const holding = await this.prisma.holding.findUnique({
      where: { id: holdingId },
      include: {
        edition: { include: { work: { include: { organization: true } } } },
        location: { include: { library: { include: { organization: true } } } },
      },
    });
    if (!holding) throw resourceNotFound();
    await this.resolveItemOrganization(
      userId,
      headerValue,
      holding,
      OrganizationRole.STAFF,
    );
    return holding;
  }

  private async resolveItemOrganization(
    userId: string,
    headerValue: OrganizationHeaderValue | undefined,
    holding: {
      edition: { work: { organizationId: string } };
      location: { library: { organizationId: string } };
    },
    requiredRole?: OrganizationRole,
  ): Promise<void> {
    const contexts = await this.contexts.resolveDerivedParentPairContext({
      userId,
      headerValue,
      firstOrganizationId: holding.edition.work.organizationId,
      secondOrganizationId: holding.location.library.organizationId,
    });
    requireHoldingOrganization(holding);
    if (requiredRole) this.contexts.requireRole(contexts.first, requiredRole);
  }
}

function validateStatus(status: string | null | undefined): void {
  if (status !== undefined && (typeof status !== 'string' || !status.trim())) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      API_ERROR_CODES.INVALID_REQUEST_DATA,
      'Item status must be a non-empty string.',
    );
  }
}

function resourceNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    'The requested resource was not found.',
  );
}
