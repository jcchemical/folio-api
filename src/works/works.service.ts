import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

export interface EditionInput {
  title: string;
  subtitle?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publisher?: string | null;
  publishDate?: Date | string | null;
  language?: string | null;
  country?: string | null;
  format?: string | null;
  pages?: number | null;
}

export interface WorkInput {
  title: string;
  subtitle?: string | null;
  organizationId?: string;
  editions?: EditionInput[];
}

export interface WorkUpdateInput {
  title?: string;
  subtitle?: string | null;
  organizationId?: string;
  editions?: EditionInput[];
}

@Injectable()
export class WorksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const organizations = await this.organizationMemberships.getOrganizations(userId);
    const organizationIds = organizations.map(({ organization }) => organization.id);
    const rows = await this.prisma.work.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { organization: true, editions: true },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: { organization: true, editions: true },
    });

    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkAccess(userId, work);
    return work;
  }

  async create(userId: string, data: WorkInput) {
    const { editions, organizationId, ...workData } = data;
    if (organizationId === null) {
      throw new BadRequestException('organizationId cannot be null');
    }
    if (organizationId) {
      await this.organizationMemberships.assertRole(
        userId,
        organizationId,
        OrganizationRole.STAFF,
      );
    }
    const organization = organizationId
      ? { id: organizationId }
      : await this.organizationMemberships.getDefaultOrganization(userId);
    if (!organization) {
      throw new ForbiddenException('User has no personal organization');
    }
    const work = await this.prisma.work.create({
      data: { ...workData, organizationId: organization.id },
    });

    if (editions?.length) {
      await this.prisma.edition.createMany({
        data: editions.map((edition) => ({ ...edition, workId: work.id })),
      });
    }

    return this.findById(work.id, userId);
  }

  async update(id: string, userId: string, data: WorkUpdateInput) {
    const { editions, organizationId, ...workData } = data;
    if (organizationId === null) {
      throw new BadRequestException('organizationId cannot be null');
    }
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
    const targetOrganizationId = organizationId === undefined
      ? work.organizationId
      : organizationId;
    await this.organizationMemberships.assertRole(
      userId,
      targetOrganizationId,
      OrganizationRole.STAFF,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.work.update({
        where: { id },
        data: { ...workData, organizationId: targetOrganizationId },
      });

      if (editions) {
        await transaction.edition.deleteMany({ where: { workId: id } });
        if (editions.length) {
          await transaction.edition.createMany({
            data: editions.map((edition) => ({ ...edition, workId: id })),
          });
        }
      }
    });

    return this.findById(id, userId);
  }

  async remove(id: string, userId: string) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);

    return this.prisma.work.delete({
      where: { id },
      include: { organization: true, editions: true },
    });
  }
}
