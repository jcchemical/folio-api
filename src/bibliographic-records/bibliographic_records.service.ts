import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

export interface BibliographicRecordInput {
  format: string;
  rawContent: string;
  source?: string | null;
  remoteId?: string | null;
  workId?: string | null;
  editionId?: string | null;
}

@Injectable()
export class BibliographicRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.bibliographicRecord.findMany({
      where: {
        OR: [
          { work: { organization: { memberships: { some: { userId } } } } },
          { edition: { work: { organization: { memberships: { some: { userId } } } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findOne(userId: string, id: string) {
    const record = await this.prisma.bibliographicRecord.findUnique({
      where: { id },
      include: { work: true, edition: { include: { work: true } } },
    });
    if (!record) throw new NotFoundException('Bibliographic record not found');

    const work = record.edition?.work ?? record.work;
    if (!work) throw new NotFoundException('Bibliographic record has no work');
    await this.organizationMemberships.assertWorkAccess(userId, work);
    return record;
  }

  async create(userId: string, data: BibliographicRecordInput) {
    await this.assertRelationsOwnership(userId, data.workId, data.editionId);
    return this.prisma.bibliographicRecord.create({ data });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<BibliographicRecordInput>,
  ) {
    await this.assertRecordOwnership(id, userId);
    return this.prisma.bibliographicRecord.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.assertRecordOwnership(id, userId);
    return this.prisma.bibliographicRecord.delete({ where: { id } });
  }

  private async assertRelationsOwnership(
    userId: string,
    workId?: string | null,
    editionId?: string | null,
  ) {
    if (!workId && !editionId)
      throw new NotFoundException('A work or edition is required');
    if (workId) await this.assertRelatedWork(workId, userId);
    if (editionId) await this.assertRelatedEdition(editionId, userId);
  }

  private async assertRelatedWork(workId: string, userId: string): Promise<void> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
  }

  private async assertRelatedEdition(
    editionId: string,
    userId: string,
  ): Promise<void> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, edition.work);
  }

  private async assertRecordOwnership(id: string, userId: string) {
    const record = await this.prisma.bibliographicRecord.findUnique({
      where: { id },
      include: { work: true, edition: { include: { work: true } } },
    });
    if (!record) throw new NotFoundException('Bibliographic record not found');

    const work = record.work ?? record.edition?.work;
    if (!work) throw new NotFoundException('Bibliographic record has no work');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
  }
}
