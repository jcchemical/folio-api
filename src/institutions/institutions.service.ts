import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    const institution = await this.prisma.institution.findUnique({ where: { id } });
    this.assertOwnership(institution, userId);
    return institution;
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
    const institution = await this.prisma.institution.findUnique({ where: { id } });
    this.assertOwnership(institution, userId);
    return this.prisma.institution.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string): Promise<Institution> {
    const institution = await this.prisma.institution.findUnique({ where: { id } });
    this.assertOwnership(institution, userId);
    return this.prisma.institution.delete({
      where: { id },
    });
  }

  private assertOwnership(
    institution: Institution | null,
    userId: string,
  ): asserts institution is Institution {
    if (!institution) throw new NotFoundException('Institution not found');
    if (institution.userId !== userId) {
      throw new ForbiddenException('Institution does not belong to the authenticated user');
    }
  }
}