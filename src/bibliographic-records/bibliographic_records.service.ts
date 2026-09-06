import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    if (workId) await this.assertRelatedWork(workId, userId);
    if (editionId) await this.assertRelatedEdition(editionId, userId);
  }

  private async assertRelatedWork(workId: string, userId: string): Promise<void> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.userId !== userId) {
      throw new ForbiddenException('Work does not belong to the authenticated user');
    }
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
    if (edition.work.userId !== userId) {
      throw new ForbiddenException('Edition does not belong to the authenticated user');
    }
  }

  private async assertRecordOwnership(id: string, userId: string) {
    const record = await this.prisma.bibliographicRecord.findUnique({
      where: { id },
      include: { work: true, edition: { include: { work: true } } },
    });
    if (!record) throw new NotFoundException('Bibliographic record not found');

    const owned =
      record.work?.userId === userId || record.edition?.work.userId === userId;
    if (!owned) {
      throw new ForbiddenException(
        'Bibliographic record does not belong to the authenticated user',
      );
    }
  }
}
