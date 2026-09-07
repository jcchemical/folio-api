import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EditionInput } from '../works/works.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

@Injectable()
export class EditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.edition.findMany({
      where: {
        work: {
          organization: { memberships: { some: { userId } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { work: true },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true, items: { where: { organization: { memberships: { some: { userId } } } } } },
    });
    await this.assertEditionAccess(edition, userId);
    return edition;
  }

  async create(userId: string, workId: string, data: EditionInput) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
    return this.prisma.edition.create({ data: { ...data, workId } });
  }

  async update(id: string, userId: string, data: Partial<EditionInput>) {
    await this.assertEditionOwnership(id, userId);
    return this.prisma.edition.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({ where: { id }, include: { work: true } });
    await this.assertEditionWriteAccess(edition, userId);
    return this.prisma.edition.delete({ where: { id } });
  }

  private async assertEditionOwnership(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    await this.assertEditionWriteAccess(edition, userId);
  }

  private async assertEditionAccess(
    edition: { work: { organizationId: string } } | null,
    userId: string,
  ): Promise<void> {
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkAccess(userId, edition.work);
  }

  private async assertEditionWriteAccess(
    edition: { work: { organizationId: string } } | null,
    userId: string,
  ): Promise<void> {
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, edition.work);
  }
}
