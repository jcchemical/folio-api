import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Institution } from '@prisma/client';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string): Promise<Institution[]> {
    return this.prisma.institution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string): Promise<Institution | null> {
    return this.prisma.institution.findFirst({
      where: { id, userId },
    });
  }

  async create(
    userId: string,
    data: { name: string; address?: string | null; description?: string | null },
  ): Promise<Institution> {
    return this.prisma.institution.create({
      data: { ...data, userId },
    });
  }

  async update(
    id: string,
    userId: string,
    data: { name?: string; address?: string | null; description?: string | null },
  ): Promise<Institution> {
    return this.prisma.institution.update({
      where: { id, userId },
      data,
    });
  }

  async remove(id: string, userId: string): Promise<Institution> {
    return this.prisma.institution.delete({
      where: { id, userId },
    });
  }
}