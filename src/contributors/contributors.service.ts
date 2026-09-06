import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';

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

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.contributor.findMany({
      where: {
        OR: [
          { workContributors: { some: { work: { userId } } } },
          { editionContributors: { some: { edition: { work: { userId } } } } },
        ],
      },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...prisma,
    });
      return paginate(rows, limit);
  }

  findById(id: string, userId: string) {
    return this.findOwnedContributor(id, userId);
  }

  private async findOwnedContributor(id: string, userId: string) {
    const contributor = await this.prisma.contributor.findUnique({
      where: { id },
      include: {
        workContributors: { include: { work: true } },
        editionContributors: { include: { edition: { include: { work: true } } } },
      },
    });
    this.assertContributorAccess(contributor, userId);
    return contributor;
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
    if (workId) await this.assertRelatedWork(workId, userId);
    if (editionId) await this.assertRelatedEdition(editionId, userId);
  }

  private async assertRelatedWork(workId: string, userId: string): Promise<void> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.userId !== userId) {
      throw new ForbiddenException('Work does not belong to the authenticated user');
    }
  }

  private async assertRelatedEdition(
    editionId: string,
    userId: string,
  ): Promise<void> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    if (edition.work.userId !== userId) {
      throw new ForbiddenException('Edition does not belong to the authenticated user');
    }
  }

  private async assertContributorOwnership(id: string, userId: string) {
    const contributor = await this.prisma.contributor.findUnique({
      where: { id },
      include: {
        workContributors: { include: { work: true } },
        editionContributors: { include: { edition: { include: { work: true } } } },
      },
    });
    this.assertContributorAccess(contributor, userId);
  }

  private assertContributorAccess(
    contributor: {
      workContributors: Array<{ work: { userId: string } }>;
      editionContributors: Array<{ edition: { work: { userId: string } } }>;
    } | null,
    userId: string,
  ): asserts contributor {
    if (!contributor) throw new NotFoundException('Contributor not found');

    const owned =
      contributor.workContributors.some(({ work }) => work.userId === userId) ||
      contributor.editionContributors.some(
        ({ edition }) => edition.work.userId === userId,
      );
    if (!owned) {
      throw new ForbiddenException(
        'Contributor does not belong to the authenticated user',
      );
    }
  }
}
