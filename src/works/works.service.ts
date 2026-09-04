import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Work } from '@prisma/client';

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string): Promise<Work[]> {
    return this.prisma.work.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { institution: true },
    });
  }

  async findById(id: string, userId: string): Promise<Work | null> {
    return this.prisma.work.findFirst({
      where: { id, userId },
      include: { institution: true },
    });
  }

  async create(
    userId: string,
    data: {
      title: string;
      description?: string | null;
      year?: number | null;
      institutionId?: string | null;
    },
  ): Promise<Work> {
    return this.prisma.work.create({
      data: { ...data, userId },
      include: { institution: true },
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      year?: number | null;
      institutionId?: string | null;
    },
  ): Promise<Work> {
    return this.prisma.work.update({
      where: { id, userId },
      data,
      include: { institution: true },
    });
  }

  async remove(id: string, userId: string): Promise<Work> {
    return this.prisma.work.delete({
      where: { id, userId },
      include: { institution: true },
    });
  }
}