import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EditionInput } from '../works/works.service.js';

@Injectable()
export class EditionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.edition.findMany({
      where: { work: { userId } },
      orderBy: { createdAt: 'desc' },
      include: { work: true },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.edition.findFirst({
      where: { id, work: { userId } },
      include: { work: true, items: true },
    });
  }

  async create(userId: string, workId: string, data: EditionInput) {
    await this.assertWorkOwnership(workId, userId);
    return this.prisma.edition.create({ data: { ...data, workId } });
  }

  async update(id: string, userId: string, data: Partial<EditionInput>) {
    await this.assertEditionOwnership(id, userId);
    return this.prisma.edition.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.assertEditionOwnership(id, userId);
    return this.prisma.edition.delete({ where: { id } });
  }

  private async assertWorkOwnership(workId: string, userId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, userId },
    });
    if (!work) throw new NotFoundException('Work not found');
  }

  private async assertEditionOwnership(id: string, userId: string) {
    const edition = await this.prisma.edition.findFirst({
      where: { id, work: { userId } },
    });
    if (!edition) throw new NotFoundException('Edition not found');
  }
}
