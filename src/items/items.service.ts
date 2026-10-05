import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

export interface ItemInput {
  label?: string | null;
  location?: string | null;
  status?: string | null;
  notes?: string | null;
  editionId: string;
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
      where: { organization: { memberships: { some: { userId } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { edition: true, organization: true },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { edition: true, organization: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    await this.organizationMemberships.assertOrganizationAccess(
      userId,
      item.organizationId,
    );
    return item;
  }

  async create(userId: string, data: ItemInput) {
    validateStatus(data.status);
    const edition = await this.requireWritableEdition(data.editionId, userId);
    return this.prisma.item.create({
      data: {
        label: data.label,
        location: data.location,
        status: data.status ?? undefined,
        notes: data.notes,
        editionId: edition.id,
        organizationId: edition.work.organizationId,
      },
    });
  }

  async update(id: string, userId: string, data: Partial<ItemInput>) {
    const item = await this.findById(id, userId);
    await this.organizationMemberships.assertRole(
      userId,
      item.organizationId,
      OrganizationRole.STAFF,
    );
    validateStatus(data.status);
    return this.prisma.item.update({
      where: { id },
      data: {
        label: data.label,
        location: data.location,
        status: data.status ?? undefined,
        notes: data.notes,
      },
    });
  }

  async remove(id: string, userId: string) {
    const item = await this.findById(id, userId);
    await this.organizationMemberships.assertRole(
      userId,
      item.organizationId,
      OrganizationRole.STAFF,
    );
    return this.prisma.item.delete({ where: { id } });
  }

  private async requireWritableEdition(editionId: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkWriteAccess(
      userId,
      edition.work,
    );
    return edition;
  }
}

function validateStatus(status: string | null | undefined): void {
  if (status !== undefined && status !== null && !status.trim()) {
    throw new BadRequestException('Item status must be a non-empty string');
  }
}
