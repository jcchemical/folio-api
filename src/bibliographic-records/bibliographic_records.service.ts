import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.bibliographicRecord.findMany({
      where: { OR: [{ work: { userId } }, { edition: { work: { userId } } }] },
      orderBy: { createdAt: 'desc' },
    });
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
    if (
      workId &&
      !(await this.prisma.work.findFirst({ where: { id: workId, userId } }))
    ) {
      throw new NotFoundException('Work not found');
    }
    if (
      editionId &&
      !(await this.prisma.edition.findFirst({
        where: { id: editionId, work: { userId } },
      }))
    ) {
      throw new NotFoundException('Edition not found');
    }
  }

  private async assertRecordOwnership(id: string, userId: string) {
    const record = await this.prisma.bibliographicRecord.findFirst({
      where: {
        id,
        OR: [{ work: { userId } }, { edition: { work: { userId } } }],
      },
    });
    if (!record) throw new NotFoundException('Bibliographic record not found');
  }
}
