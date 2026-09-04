import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ExternalIdentifierInput {
  type: string;
  value: string;
  source?: string | null;
  editionId: string;
}

@Injectable()
export class ExternalIdentifiersService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.externalIdentifier.findMany({
      where: { edition: { work: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: ExternalIdentifierInput) {
    await this.assertEditionOwnership(data.editionId, userId);
    return this.prisma.externalIdentifier.create({ data });
  }

  async update(
    id: string,
    userId: string,
    data: Partial<ExternalIdentifierInput>,
  ) {
    await this.assertIdentifierOwnership(id, userId);
    return this.prisma.externalIdentifier.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.assertIdentifierOwnership(id, userId);
    return this.prisma.externalIdentifier.delete({ where: { id } });
  }

  private async assertEditionOwnership(editionId: string, userId: string) {
    const edition = await this.prisma.edition.findFirst({
      where: { id: editionId, work: { userId } },
    });
    if (!edition) throw new NotFoundException('Edition not found');
  }

  private async assertIdentifierOwnership(id: string, userId: string) {
    const identifier = await this.prisma.externalIdentifier.findFirst({
      where: { id, edition: { work: { userId } } },
    });
    if (!identifier)
      throw new NotFoundException('External identifier not found');
  }
}
