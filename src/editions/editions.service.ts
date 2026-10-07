import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import type { EditionInput } from '../works/works.service.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { OrganizationRole } from '@prisma/client';
import { EditionOutputDto } from './dto/edition-output.dto.js';
import {
  derivePublicationProjection,
  normalizePublicationDateLiteral,
} from './dto/publication-statement.dto.js';

@Injectable()
export class EditionsService {
  private readonly logger = new Logger(EditionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async findAllByUser(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: PaginationInput = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.edition.findMany({
      where: {
        work: { organizationId: context.organizationId },
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
        editionCovers: {
          where: { isActive: true },
          take: 1,
          select: { id: true },
        },
      },
      ...prisma,
    });
    return paginate(rows.map(toEditionOutput), limit);
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
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
        holdings: {
          include: {
            location: { include: { library: true } },
            items: true,
          },
        },
        editionCovers: {
          where: { isActive: true },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!edition) throw resourceNotFound('Edition');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
    });
    return toEditionOutput({
      ...edition,
      contributions: [
        ...scopeContributions(edition.work.contributions, 'WORK'),
        ...scopeContributions(edition.contributions, 'EDITION'),
      ],
    });
  }

  async create(
    userId: string,
    workId: string,
    data: EditionInput,
    headerValue?: OrganizationHeaderValue,
  ) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw resourceNotFound('Work');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    const { physicalDescriptions, publicationStatements, ...edition } = data;
    const projection = publicationStatements?.length
      ? derivePublicationProjection({ statements: publicationStatements })
      : null;
    if (projection?.warnings.length)
      this.logger.warn(JSON.stringify(projection.warnings));
    const created = await this.prisma.edition.create({
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
        editionCovers: {
          where: { isActive: true },
          take: 1,
          select: { id: true },
        },
      },
    });
    return toEditionOutput(created);
  }

  async update(
    id: string,
    userId: string,
    data: Partial<EditionInput>,
    headerValue?: OrganizationHeaderValue,
  ) {
    await this.assertEditionWriteAccess(id, userId, headerValue);
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
      const result = await transaction.edition.findUniqueOrThrow({
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
          editionCovers: {
            where: { isActive: true },
            take: 1,
            select: { id: true },
          },
        },
      });
      return toEditionOutput(result);
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    if (!edition) throw resourceNotFound('Edition');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.edition.delete({ where: { id } });
  }

  private async assertEditionWriteAccess(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    if (!edition) throw resourceNotFound('Edition');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
  }
}

function resourceNotFound(resource: string): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} not found.`,
  );
}

function toEditionOutput<T extends { id: string } & Record<string, unknown>>(
  edition: T,
): Omit<T, 'editionCovers'> & { coverUrl: string | null } {
  const editionCovers = edition.editionCovers as
    Array<{ id: string }> | undefined;
  const { editionCovers: _editionCovers, ...output } = edition;
  return new EditionOutputDto(output, Boolean(editionCovers?.length)) as Omit<
    T,
    'editionCovers'
  > & { coverUrl: string | null };
}

function scopeContributions<T extends { id: string; sortOrder: number }>(
  contributions: T[],
  scope: 'WORK' | 'EDITION',
): Array<T & { scope: 'WORK' | 'EDITION' }> {
  return contributions.map((contribution) => ({ ...contribution, scope }));
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
