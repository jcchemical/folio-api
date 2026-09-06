import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true, items: true },
    });
    this.assertEditionAccess(edition, userId);
    return edition;
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
    const edition = await this.prisma.edition.findUnique({ where: { id }, include: { work: true } });
    this.assertEditionAccess(edition, userId);
    return this.prisma.edition.delete({ where: { id } });
  }

  private async assertWorkOwnership(workId: string, userId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.userId !== userId) {
      throw new ForbiddenException('Work does not belong to the authenticated user');
    }
  }

  private async assertEditionOwnership(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    this.assertEditionAccess(edition, userId);
  }

  private assertEditionAccess(
    edition: { work: { userId: string } } | null,
    userId: string,
  ): asserts edition is { work: { userId: string } } {
    if (!edition) throw new NotFoundException('Edition not found');
    if (edition.work.userId !== userId) {
      throw new ForbiddenException('Edition does not belong to the authenticated user');
    }
  }
}
