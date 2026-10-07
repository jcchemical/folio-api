import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { paginate, paginationArgs } from '../common/pagination.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireHoldingOrganization } from './holding-ownership.js';
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
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: holdingRelations,
    });
    if (!holding) throw resourceNotFound('Holding');
    const organizationId = requireHoldingOrganization(holding);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
    });
    return holding;
  }

  async create(
    userId: string,
    input: CreateHoldingDto,
    headerValue?: OrganizationHeaderValue,
  ) {
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
    if (!edition) throw resourceNotFound('Edition');
    if (!location) throw resourceNotFound('Location');

    const organizationId = requireHoldingOrganization({ edition, location });
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.STAFF,
    });

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
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: holdingRelations,
    });
    if (!holding) throw resourceNotFound('Holding');
    const organizationId = requireHoldingOrganization(holding);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
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
    const holding = await this.prisma.holding.findUnique({
      where: { id },
      include: holdingRelations,
    });
    if (!holding) throw resourceNotFound('Holding');
    const organizationId = requireHoldingOrganization(holding);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.holding.delete({ where: { id } });
  }
}

function resourceNotFound(resource: string): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} not found.`,
  );
}
