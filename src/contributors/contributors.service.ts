import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ContributorInput {
  name: string;
  variantNames?: string[];
}

@Injectable()
export class ContributorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.contributor.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.contributor.findUnique({
      where: { id },
      include: { workContributors: true, editionContributors: true },
    });
  }

  create(data: ContributorInput) {
    return this.prisma.contributor.create({
      data: { name: data.name, variantNames: data.variantNames ?? [] },
    });
  }

  update(id: string, data: Partial<ContributorInput>) {
    return this.prisma.contributor.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.contributor.delete({ where: { id } });
  }
}
