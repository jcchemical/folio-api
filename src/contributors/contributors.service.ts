import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.contributor.findMany({
      where: {
        OR: [
          {
            workContributors: {
              some: {
                work: { organization: { memberships: { some: { userId } } } },
              },
            },
          },
          {
            editionContributors: {
              some: {
                edition: {
                  work: { organization: { memberships: { some: { userId } } } },
                },
              },
            },
          },
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
        editionContributors: {
          include: { edition: { include: { work: true } } },
        },
      },
    });
    await this.assertContributorAccess(contributor, userId);
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

  private async assertRelatedWork(
    workId: string,
    userId: string,
  ): Promise<void> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Work not found.',
      );
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
  }

  private async assertRelatedEdition(
    editionId: string,
    userId: string,
  ): Promise<void> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.EDITION_NOT_FOUND,
        'Edition not found.',
      );
    await this.organizationMemberships.assertWorkWriteAccess(
      userId,
      edition.work,
    );
  }

  private async assertContributorOwnership(id: string, userId: string) {
    const contributor = await this.prisma.contributor.findUnique({
      where: { id },
      include: {
        workContributors: { include: { work: true } },
        editionContributors: {
          include: { edition: { include: { work: true } } },
        },
      },
    });
    await this.assertContributorWriteAccess(contributor, userId);
  }

  private async assertContributorAccess(
    contributor: {
      workContributors: Array<{ work: { organizationId: string } }>;
      editionContributors: Array<{
        edition: { work: { organizationId: string } };
      }>;
    } | null,
    userId: string,
  ): Promise<void> {
    if (!contributor)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Contributor not found.',
      );
    await this.assertAllRelatedWorkAccess(
      userId,
      [
        ...contributor.workContributors.map(({ work }) => work),
        ...contributor.editionContributors.map(({ edition }) => edition.work),
      ],
      false,
    );
  }

  private async assertContributorWriteAccess(
    contributor: {
      workContributors: Array<{ work: { organizationId: string } }>;
      editionContributors: Array<{
        edition: { work: { organizationId: string } };
      }>;
    } | null,
    userId: string,
  ): Promise<void> {
    if (!contributor)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Contributor not found.',
      );
    await this.assertAllRelatedWorkAccess(
      userId,
      [
        ...contributor.workContributors.map(({ work }) => work),
        ...contributor.editionContributors.map(({ edition }) => edition.work),
      ],
      true,
    );
  }

  private async assertAllRelatedWorkAccess(
    userId: string,
    works: Array<{ organizationId: string }>,
    writable: boolean,
  ): Promise<void> {
    if (!works.length) throw allMembershipsRequired();
    for (const work of works) {
      try {
        if (writable) {
          await this.organizationMemberships.assertWorkWriteAccess(
            userId,
            work,
          );
        } else {
          await this.organizationMemberships.assertWorkAccess(userId, work);
        }
      } catch (error: unknown) {
        if (
          error instanceof HttpException &&
          error.getStatus() === HttpStatus.FORBIDDEN
        ) {
          throw allMembershipsRequired();
        }
        throw error;
      }
    }
  }
}

function allMembershipsRequired(): ApiException {
  return new ApiException(
    HttpStatus.FORBIDDEN,
    API_ERROR_CODES.UNAUTHORIZED_ALL_MEMBERSHIPS,
    'Access to every organization linked to this legacy Contributor is required.',
  );
}
