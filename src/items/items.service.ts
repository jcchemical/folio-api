import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ItemInput {
  label?: string | null;
  location?: string | null;
  status?: string;
  notes?: string | null;
  editionId: string;
  institutionId?: string | null;
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.item.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { edition: true, institution: true },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.item.findFirst({
      where: { id, userId },
      include: { edition: true, institution: true },
    });
  }

  async create(userId: string, data: ItemInput) {
    await this.assertEditionOwnership(data.editionId, userId);
    await this.assertInstitutionOwnership(data.institutionId, userId);
    return this.prisma.item.create({ data: { ...data, userId } });
  }

  async update(id: string, userId: string, data: Partial<ItemInput>) {
    await this.assertItemOwnership(id, userId);
    if (data.editionId)
      await this.assertEditionOwnership(data.editionId, userId);
    await this.assertInstitutionOwnership(data.institutionId, userId);
    return this.prisma.item.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.assertItemOwnership(id, userId);
    return this.prisma.item.delete({ where: { id } });
  }

  private async assertEditionOwnership(editionId: string, userId: string) {
    const edition = await this.prisma.edition.findFirst({
      where: { id: editionId, work: { userId } },
    });
    if (!edition) throw new NotFoundException('Edition not found');
  }

  private async assertInstitutionOwnership(
    institutionId: string | null | undefined,
    userId: string,
  ) {
    if (!institutionId) return;
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, userId },
    });
    if (!institution) throw new NotFoundException('Institution not found');
  }

  private async assertItemOwnership(id: string, userId: string) {
    const item = await this.prisma.item.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Item not found');
  }
}
