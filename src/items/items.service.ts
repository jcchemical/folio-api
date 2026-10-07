import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

export interface ItemInput {
  label?: string | null;
  status?: string | null;
  notes?: string | null;
  holdingId: string;
}

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.item.findMany({
      where: {
        holding: {
          edition: {
            work: { organization: { memberships: { some: { userId } } } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        holding: {
          include: {
            edition: true,
            location: { include: { library: true } },
          },
        },
      },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        holding: {
          include: {
            edition: { include: { work: true } },
            location: { include: { library: true } },
          },
        },
      },
    });
    if (!item)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Item not found.',
      );
    await this.organizationMemberships.assertOrganizationAccess(
      userId,
      item.holding.edition.work.organizationId,
    );
    return item;
  }

  async create(userId: string, data: ItemInput) {
    validateStatus(data.status);
    const holding = await this.requireWritableHolding(data.holdingId, userId);
    return this.prisma.item.create({
      data: {
        label: data.label,
        status: data.status ?? undefined,
        notes: data.notes,
        holdingId: holding.id,
      },
    });
  }

  async update(id: string, userId: string, data: Partial<ItemInput>) {
    const item = await this.findById(id, userId);
    await this.organizationMemberships.assertRole(
      userId,
      item.holding.edition.work.organizationId,
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
    });
  }

  async remove(id: string, userId: string) {
    const item = await this.findById(id, userId);
    await this.organizationMemberships.assertRole(
      userId,
      item.holding.edition.work.organizationId,
      OrganizationRole.STAFF,
    );
    return this.prisma.item.delete({ where: { id } });
  }

  private async requireWritableHolding(holdingId: string, userId: string) {
    const holding = await this.prisma.holding.findUnique({
      where: { id: holdingId },
      include: {
        edition: { include: { work: true } },
        location: { include: { library: true } },
      },
    });
    if (!holding)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Holding not found.',
      );
    await this.organizationMemberships.assertWorkWriteAccess(
      userId,
      holding.edition.work,
    );
    return holding;
  }
}

function validateStatus(status: string | null | undefined): void {
  if (status !== undefined && status !== null && !status.trim()) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      API_ERROR_CODES.INVALID_REQUEST_DATA,
      'Item status must be a non-empty string.',
    );
  }
}
