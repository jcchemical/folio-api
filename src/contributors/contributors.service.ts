import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ContributorInput {
  name: string;
  variantNames?: string[];
  workId?: string;
  editionId?: string;
  role?: string;
  sortOrder?: number;
}

@Injectable()
export class ContributorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.contributor.findMany({
      where: {
        OR: [
          { workContributors: { some: { work: { userId } } } },
          { editionContributors: { some: { edition: { work: { userId } } } } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.contributor.findUnique({
      where: {
        id,
        OR: [
          { workContributors: { some: { work: { userId } } } },
          { editionContributors: { some: { edition: { work: { userId } } } } },
        ],
      },
      include: { workContributors: true, editionContributors: true },
    });
  }

  async create(userId: string, data: ContributorInput) {
    if (!data.workId && !data.editionId) {
      throw new BadRequestException(
        'A workId or editionId is required to scope the contributor',
      );
    }

    await this.assertRelationsOwnership(userId, data.workId, data.editionId);

    return this.prisma.contributor.create({
      data: {
        name: data.name,
        variantNames: data.variantNames ?? [],
        ...(data.workId
          ? {
              workContributors: {
                create: {
                  workId: data.workId,
                  role: data.role ?? 'author',
                  sortOrder: data.sortOrder ?? 0,
                },
              },
            }
          : {}),
        ...(data.editionId
          ? {
              editionContributors: {
                create: {
                  editionId: data.editionId,
                  role: data.role ?? 'author',
                  sortOrder: data.sortOrder ?? 0,
                },
              },
            }
          : {}),
      },
    });
  }

  async update(id: string, userId: string, data: Partial<ContributorInput>) {
    await this.assertContributorOwnership(id, userId);
    return this.prisma.contributor.update({
      where: { id },
      data: {
        ...(data.name === undefined ? {} : { name: data.name }),
        ...(data.variantNames === undefined
          ? {}
          : { variantNames: data.variantNames }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.assertContributorOwnership(id, userId);
    return this.prisma.contributor.delete({ where: { id } });
  }

  private async assertRelationsOwnership(
    userId: string,
    workId?: string,
    editionId?: string,
  ) {
    if (
      workId &&
      !(await this.prisma.work.findFirst({ where: { id: workId, userId } }))
    ) {
      throw new NotFoundException('Work not found');
    }
    if (
      editionId &&
      !(await this.prisma.edition.findFirst({
        where: { id: editionId, work: { userId } },
      }))
    ) {
      throw new NotFoundException('Edition not found');
    }
  }

  private async assertContributorOwnership(id: string, userId: string) {
    const contributor = await this.prisma.contributor.findFirst({
      where: {
        id,
        OR: [
          { workContributors: { some: { work: { userId } } } },
          { editionContributors: { some: { edition: { work: { userId } } } } },
        ],
      },
    });
    if (!contributor) throw new NotFoundException('Contributor not found');
  }
}
