import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';

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

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.item.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { edition: true, institution: true },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { edition: true, institution: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.userId !== userId) {
      throw new ForbiddenException('Item does not belong to the authenticated user');
    }
    return item;
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
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    if (edition.work.userId !== userId) {
      throw new ForbiddenException('Edition does not belong to the authenticated user');
    }
  }

  private async assertInstitutionOwnership(
    institutionId: string | null | undefined,
    userId: string,
  ) {
    if (!institutionId) return;
    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException('Institution not found');
    if (institution.userId !== userId) {
      throw new ForbiddenException('Institution does not belong to the authenticated user');
    }
  }

  private async assertItemOwnership(id: string, userId: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.userId !== userId) {
      throw new ForbiddenException('Item does not belong to the authenticated user');
    }
  }
}
