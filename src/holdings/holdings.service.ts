import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { paginate, paginationArgs } from '../common/pagination.js';
import {
  OrganizationContextResolver,
  parseOrganizationContextHeader,
} from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireHoldingOrganization } from './holding-ownership.js';
import { deleteExternalIdentifiers } from '../external-identifiers/external-identifier-cleanup.js';
import type {
  CreateHoldingDto,
  HoldingListQueryDto,
  UpdateHoldingDto,
} from './dto/holding.dto.js';

const holdingRelations = {
  edition: { include: { work: { include: { organization: true } } } },
  location: { include: { library: { include: { organization: true } } } },
  items: true,
};

@Injectable()
export class HoldingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async findAll(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: HoldingListQueryDto = { limit: 25 },
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.holding.findMany({
      where: {
        edition: { work: { organizationId: context.organizationId } },
        location: { library: { organizationId: context.organizationId } },
        ...(query.editionId ? { editionId: query.editionId } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: holdingRelations,
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
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: holdingRelations,
    });
    if (!holding) throw resourceNotFound();
    await this.resolveHoldingOrganization(userId, headerValue, holding);
    return holding;
  }

  async create(
    userId: string,
    input: CreateHoldingDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const [edition, location] = await Promise.all([
      this.prisma.edition.findUnique({
        where: { id: input.editionId },
        include: { work: { select: { organizationId: true } } },
      }),
      this.prisma.location.findUnique({
        where: { id: input.locationId },
        include: { library: { select: { organizationId: true } } },
      }),
    ]);
    if (!edition) throw resourceNotFound();
    if (!location) throw resourceNotFound();

    await this.resolveHoldingOrganization(
      userId,
      headerValue,
      { edition, location },
      OrganizationRole.STAFF,
    );

    return this.prisma.holding.create({
      data: {
        editionId: edition.id,
        locationId: location.id,
        callNumber: input.callNumber?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      include: holdingRelations,
    });
  }

  async update(
    id: string,
    userId: string,
    input: UpdateHoldingDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: holdingRelations,
    });
    if (!holding) throw resourceNotFound();
    await this.resolveHoldingOrganization(
      userId,
      headerValue,
      holding,
      OrganizationRole.STAFF,
    );
    return this.prisma.holding.update({
      where: { id },
      data: {
        callNumber:
          input.callNumber === undefined
            ? undefined
            : input.callNumber?.trim() || null,
        notes:
          input.notes === undefined ? undefined : input.notes?.trim() || null,
      },
      include: holdingRelations,
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: holdingRelations,
    });
    if (!holding) throw resourceNotFound();
    await this.resolveHoldingOrganization(
      userId,
      headerValue,
      holding,
      OrganizationRole.STAFF,
    );
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.item.findMany({
        where: { holdingId: id },
        select: { id: true },
      });
      const itemIds = items.map(({ id: itemId }) => itemId);

      await deleteExternalIdentifiers(tx, 'Holding', [id]);
      await deleteExternalIdentifiers(tx, 'Item', itemIds);
      return tx.holding.delete({ where: { id } });
    });
  }

  private async resolveHoldingOrganization(
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

function resourceNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    'The requested resource was not found.',
  );
}
