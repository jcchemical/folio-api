import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import type { PhysicalDescriptionInput } from '../editions/dto/physical-description.dto.js';
import type { PublicationStatementInput } from '../editions/dto/publication-statement.dto.js';
import {
  derivePublicationProjection,
  normalizePublicationDateLiteral,
} from '../editions/dto/publication-statement.dto.js';

export interface EditionInput {
  title: string;
  subtitle?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publisher?: string | null;
  publicationDate?: string | null;
  publicationPlace?: string | null;
  publicationStatements?: PublicationStatementInput[];
  language?: string | null;
  country?: string | null;
  format?: string | null;
  physicalDescriptions?: PhysicalDescriptionInput[];
}

export interface WorkInput {
  title: string;
  subtitle?: string | null;
  organizationId?: string;
  editions?: EditionInput[];
}

export interface WorkUpdateInput {
  title?: string;
  subtitle?: string | null;
  organizationId?: string;
  editions?: EditionInput[];
}

@Injectable()
export class WorksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const organizations =
      await this.organizationMemberships.getOrganizations(userId);
    const organizationIds = organizations.map(
      ({ organization }) => organization.id,
    );
    const rows = await this.prisma.work.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        organization: true,
        titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        editions: {
          include: {
            titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            responsibilityStatements: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
            languages: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            series: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            editionStatements: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
            notes: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            classifications: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            physicalDescriptions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
            publicationStatements: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
          },
        },
      },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        organization: true,
        titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        workContributors: { include: { contributor: true } },
        contributions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            agent: true,
            sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
        editions: {
          include: {
            titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            responsibilityStatements: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
            languages: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            series: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            editionStatements: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
            notes: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            classifications: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            physicalDescriptions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
            publicationStatements: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
          },
        },
      },
    });

    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkAccess(userId, work);
    return {
      ...work,
      contributions: (work.contributions ?? []).length
        ? (work.contributions ?? []).map((contribution) => ({
            ...contribution,
            scope: 'WORK' as const,
          }))
        : (work.workContributors ?? []).map((relation) => ({
            id: relation.id,
            sortOrder: relation.sortOrder,
            scope: 'WORK' as const,
            roleLabel: relation.role,
            agent: {
              id: relation.contributor.id,
              displayName: relation.contributor.name,
              kind: 'UNKNOWN' as const,
            },
            sourceParts: [],
          })),
    };
  }

  async create(userId: string, data: WorkInput) {
    const { editions, organizationId, ...workData } = data;
    if (organizationId === null) {
      throw new BadRequestException('organizationId cannot be null');
    }
    if (organizationId) {
      await this.organizationMemberships.assertRole(
        userId,
        organizationId,
        OrganizationRole.STAFF,
      );
    }
    const organization = organizationId
      ? { id: organizationId }
      : await this.organizationMemberships.getDefaultOrganization(userId);
    if (!organization) {
      throw new ForbiddenException('User has no personal organization');
    }
    const work = await this.prisma.work.create({
      data: { ...workData, organizationId: organization.id },
    });

    if (editions?.length) {
      await Promise.all(
        editions.map(
          ({ physicalDescriptions, publicationStatements, ...edition }) =>
            this.prisma.edition.create({
              data: {
                ...edition,
                ...projectionData(publicationStatements),
                workId: work.id,
                pageCount: derivePageCount(physicalDescriptions),
                physicalDescriptions: physicalDescriptions?.length
                  ? {
                      create: physicalDescriptions.map(
                        toPhysicalDescriptionCreate,
                      ),
                    }
                  : undefined,
                publicationStatements: publicationStatements?.length
                  ? {
                      create: publicationStatements.map(
                        toPublicationStatementCreate,
                      ),
                    }
                  : undefined,
              },
            }),
        ),
      );
    }

    return this.findById(work.id, userId);
  }

  async update(id: string, userId: string, data: WorkUpdateInput) {
    const { editions, organizationId, ...workData } = data;
    if (organizationId === null) {
      throw new BadRequestException('organizationId cannot be null');
    }
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
    const targetOrganizationId =
      organizationId === undefined ? work.organizationId : organizationId;
    await this.organizationMemberships.assertRole(
      userId,
      targetOrganizationId,
      OrganizationRole.STAFF,
    );

    await this.prisma.$transaction(async (transaction) => {
      await transaction.work.update({
        where: { id },
        data: { ...workData, organizationId: targetOrganizationId },
      });

      if (editions) {
        await transaction.edition.deleteMany({ where: { workId: id } });
        if (editions.length) {
          await Promise.all(
            editions.map(
              ({ physicalDescriptions, publicationStatements, ...edition }) =>
                transaction.edition.create({
                  data: {
                    ...edition,
                    ...projectionData(publicationStatements),
                    workId: id,
                    pageCount: derivePageCount(physicalDescriptions),
                    physicalDescriptions: physicalDescriptions?.length
                      ? {
                          create: physicalDescriptions.map(
                            toPhysicalDescriptionCreate,
                          ),
                        }
                      : undefined,
                    publicationStatements: publicationStatements?.length
                      ? {
                          create: publicationStatements.map(
                            toPublicationStatementCreate,
                          ),
                        }
                      : undefined,
                  },
                }),
            ),
          );
        }
      }
    });

    return this.findById(id, userId);
  }

  async remove(id: string, userId: string) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);

    return this.prisma.work.delete({
      where: { id },
      include: { organization: true, editions: true },
    });
  }
}

function toPhysicalDescriptionCreate(
  description: NonNullable<EditionInput['physicalDescriptions']>[number],
) {
  return {
    sortOrder: description.sortOrder,
    source: description.source ?? null,
    parts: {
      create: description.parts.map((part) => ({
        subfield: part.subfield.toLowerCase(),
        value: part.value.trim(),
        sortOrder: part.sortOrder,
        normalizedValue: null,
      })),
    },
  };
}

function toPublicationStatementCreate(
  statement: NonNullable<EditionInput['publicationStatements']>[number],
) {
  return {
    sortOrder: statement.sortOrder,
    indicator1: statement.indicator1 ?? ' ',
    indicator2: statement.indicator2 ?? '9',
    source: null,
    parts: {
      create: statement.parts.map((part) => ({
        subfield: part.subfield.toLowerCase(),
        value: part.value.trim(),
        sortOrder: part.sortOrder,
        groupIndex: part.groupIndex ?? 0,
        normalizedValue:
          part.subfield.toLowerCase() === 'd'
            ? normalizePublicationDateLiteral(part.value.trim())
            : null,
      })),
    },
  };
}

function projectionData(statements: EditionInput['publicationStatements']) {
  if (!statements?.length) return {};
  const projection = derivePublicationProjection({ statements });
  return {
    publisher: projection.publisher,
    publicationDate: projection.publicationDate,
    publicationPlace: projection.publicationPlace,
  };
}

function derivePageCount(
  descriptions: EditionInput['physicalDescriptions'] | undefined,
): number | null {
  const candidates = (descriptions ?? [])
    .flatMap(({ parts }) => parts)
    .filter(({ subfield }) => subfield.toLowerCase() === 'a')
    .map(({ value }) => /^(\d+)\s*(?:p\.?|pages?)$/i.exec(value.trim())?.[1])
    .filter((value): value is string => Boolean(value));
  return candidates.length === 1 ? Number(candidates[0]) : null;
}
