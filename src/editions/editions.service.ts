import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EditionInput } from '../works/works.service.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import {
  derivePublicationProjection,
  normalizePublicationDateLiteral,
} from './dto/publication-statement.dto.js';

@Injectable()
export class EditionsService {
  private readonly logger = new Logger(EditionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.edition.findMany({
      where: {
        work: {
          organization: { memberships: { some: { userId } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        work: {
          include: {
            titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            contributions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                agent: true,
                sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
          },
        },
        contributions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            agent: true,
            sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
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
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: {
        work: {
          include: {
            titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            workContributors: { include: { contributor: true } },
            contributions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                agent: true,
                sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
          },
        },
        contributions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            agent: true,
            sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
        editionContributors: { include: { contributor: true } },
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
        items: {
          where: { organization: { memberships: { some: { userId } } } },
        },
      },
    });
    await this.assertEditionAccess(edition, userId);
    if (!edition) throw new NotFoundException('Edition not found');
    return {
      ...edition,
      contributions: [
        ...contributionViews(
          edition.work.contributions,
          edition.work.workContributors,
          'WORK',
        ),
        ...contributionViews(
          edition.contributions,
          edition.editionContributors,
          'EDITION',
        ),
      ],
    };
  }

  async create(userId: string, workId: string, data: EditionInput) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
    const { physicalDescriptions, publicationStatements, ...edition } = data;
    const projection = publicationStatements?.length
      ? derivePublicationProjection({ statements: publicationStatements })
      : null;
    if (projection?.warnings.length)
      this.logger.warn(JSON.stringify(projection.warnings));
    return this.prisma.edition.create({
      data: {
        ...edition,
        ...(projection
          ? {
              publisher: projection.publisher,
              publicationDate: projection.publicationDate,
              publicationPlace: projection.publicationPlace,
            }
          : {}),
        pageCount: derivePageCount(physicalDescriptions),
        workId,
        physicalDescriptions: physicalDescriptions?.length
          ? { create: physicalDescriptions.map(toPhysicalDescriptionCreate) }
          : undefined,
        publicationStatements: publicationStatements?.length
          ? { create: publicationStatements.map(toPublicationStatementCreate) }
          : undefined,
      },
      include: {
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
      },
    });
  }

  async update(id: string, userId: string, data: Partial<EditionInput>) {
    await this.assertEditionOwnership(id, userId);
    const { physicalDescriptions, publicationStatements, ...edition } = data;
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.edition.update({
        where: { id },
        data: {
          ...edition,
          ...(publicationStatements !== undefined
            ? publicationStatements.length
              ? (() => {
                  const projection = derivePublicationProjection({
                    statements: publicationStatements,
                  });
                  this.logger.warn(JSON.stringify(projection.warnings));
                  return {
                    publisher: projection.publisher,
                    publicationDate: projection.publicationDate,
                    publicationPlace: projection.publicationPlace,
                  };
                })()
              : {
                  publisher: null,
                  publicationDate: null,
                  publicationPlace: null,
                }
            : {}),
          ...(physicalDescriptions !== undefined
            ? { pageCount: derivePageCount(physicalDescriptions) }
            : {}),
        },
      });
      if (physicalDescriptions !== undefined) {
        await transaction.physicalDescription.deleteMany({
          where: { editionId: id },
        });
        if (physicalDescriptions.length) {
          await transaction.physicalDescription.createMany({
            data: physicalDescriptions.map((description) => ({
              editionId: id,
              sortOrder: description.sortOrder,
              source: description.source ?? null,
            })),
          });
          const fields = await transaction.physicalDescription.findMany({
            where: { editionId: id },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          });
          for (const [index, description] of physicalDescriptions.entries()) {
            const field = fields[index];
            await transaction.physicalDescriptionPart.createMany({
              data: description.parts.map((part) => ({
                physicalDescriptionId: field.id,
                subfield: part.subfield.toLowerCase(),
                value: part.value.trim(),
                sortOrder: part.sortOrder,
                normalizedValue: null,
              })),
            });
          }
        }
      }
      if (publicationStatements !== undefined) {
        await transaction.publicationStatement.deleteMany({
          where: { editionId: id },
        });
        if (publicationStatements.length) {
          await transaction.publicationStatement.createMany({
            data: publicationStatements.map((statement) => ({
              editionId: id,
              sortOrder: statement.sortOrder,
              indicator1: statement.indicator1 ?? ' ',
              indicator2: statement.indicator2 ?? '9',
              source: null,
            })),
          });
          const fields = await transaction.publicationStatement.findMany({
            where: { editionId: id },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          });
          for (const [index, statement] of publicationStatements.entries()) {
            await transaction.publicationStatementPart.createMany({
              data: statement.parts.map((part) => ({
                publicationStatementId: fields[index].id,
                subfield: part.subfield.toLowerCase(),
                value: part.value.trim(),
                sortOrder: part.sortOrder,
                groupIndex: part.groupIndex ?? 0,
                normalizedValue: null,
              })),
            });
          }
        }
      }
      return transaction.edition.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
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
      });
    });
  }

  async remove(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    await this.assertEditionWriteAccess(edition, userId);
    return this.prisma.edition.delete({ where: { id } });
  }

  private async assertEditionOwnership(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    await this.assertEditionWriteAccess(edition, userId);
  }

  private async assertEditionAccess(
    edition: { work: { organizationId: string } } | null,
    userId: string,
  ): Promise<void> {
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkAccess(userId, edition.work);
  }

  private async assertEditionWriteAccess(
    edition: { work: { organizationId: string } } | null,
    userId: string,
  ): Promise<void> {
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkWriteAccess(
      userId,
      edition.work,
    );
  }
}

function contributionViews(
  canonical: Array<{ id: string; sortOrder: number; agent: unknown }>,
  legacy: Array<{
    id: string;
    role: string;
    sortOrder: number;
    contributor: { id: string; name: string };
  }>,
  scope: 'WORK' | 'EDITION',
) {
  if (canonical.length)
    return canonical.map((contribution) => ({ ...contribution, scope }));
  return legacy.map((relation) => ({
    id: relation.id,
    sortOrder: relation.sortOrder,
    scope,
    roleLabel: relation.role,
    agent: {
      id: relation.contributor.id,
      displayName: relation.contributor.name,
      kind: 'UNKNOWN' as const,
    },
    sourceParts: [],
  }));
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
        normalizedValue:
          part.subfield.toLowerCase() === 'd'
            ? normalizePublicationDateLiteral(part.value.trim())
            : null,
      })),
    },
  };
}

function toPublicationStatementCreate(
  description: NonNullable<EditionInput['publicationStatements']>[number],
) {
  return {
    sortOrder: description.sortOrder,
    indicator1: description.indicator1 ?? ' ',
    indicator2: description.indicator2 ?? '9',
    source: null,
    parts: {
      create: description.parts.map((part) => ({
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
