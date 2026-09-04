import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
  institutionId?: string | null;
  editions?: EditionInput[];
}

export interface WorkUpdateInput {
  title?: string;
  subtitle?: string | null;
  institutionId?: string | null;
  editions?: EditionInput[];
}

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string) {
    return this.prisma.work.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { institution: true, editions: true },
    });
  }

  async findById(id: string, userId: string) {
    return this.prisma.work.findFirst({
      where: { id, userId },
      include: { institution: true, editions: true },
    });
  }

  async create(userId: string, data: WorkInput) {
    const { editions, ...workData } = data;
    const work = await this.prisma.work.create({
      data: { ...workData, userId },
    });

    if (editions?.length) {
      await this.prisma.edition.createMany({
        data: editions.map((edition) => ({ ...edition, workId: work.id })),
      });
    }

    return this.findById(work.id, userId);
  }

  async update(id: string, userId: string, data: WorkUpdateInput) {
    const { editions, ...workData } = data;
    const work = await this.prisma.work.findFirst({ where: { id, userId } });

    if (!work) {
      return null;
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.work.update({ where: { id }, data: workData });

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
    return this.prisma.work.delete({
      where: { id, userId },
      include: { institution: true, editions: true },
    });
  }
}
