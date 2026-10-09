import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import {
  paginate,
  paginationArgs,
  type PaginationInput,
} from '../common/pagination.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import type { PhysicalDescriptionInput } from '../editions/dto/physical-description.dto.js';
import type { PublicationStatementInput } from '../editions/dto/publication-statement.dto.js';
import { EditionOutputDto } from '../editions/dto/edition-output.dto.js';
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
  editions?: EditionInput[];
}

export interface WorkUpdateInput {
  title?: string;
  subtitle?: string | null;
}

@Injectable()
export class WorksService {
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
    const rows = await this.prisma.work.findMany({
      where: { organizationId: context.organizationId },
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
            editionCovers: {
              where: { isActive: true },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
      ...prisma,
    });
    return paginate(rows.map(withEditionCoverUrls), limit);
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        organization: true,
        titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
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
            editionCovers: {
              where: { isActive: true },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });

    if (!work) throw resourceNotFound('Work');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: work.organizationId,
    });
    return {
      ...work,
      contributions: (work.contributions ?? []).map((contribution) => ({
        ...contribution,
        scope: 'WORK' as const,
      })),
      editions: work.editions.map((edition) =>
        toEditionOutput(edition as unknown as Record<string, unknown>),
      ),
    };
  }

  async create(
    userId: string,
    headerValue: OrganizationHeaderValue,
    data: WorkInput,
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
      requiredRole: OrganizationRole.STAFF,
    });
    const { editions, ...workData } = data;
    const work = await this.prisma.$transaction(async (transaction) => {
      const createdWork = await transaction.work.create({
        data: { ...workData, organizationId: context.organizationId },
      });

      for (const editionInput of editions ?? []) {
        const { physicalDescriptions, publicationStatements, ...edition } =
          editionInput;
        await transaction.edition.create({
          data: {
            ...edition,
            ...projectionData(publicationStatements),
            workId: createdWork.id,
            pageCount: derivePageCount(physicalDescriptions),
            physicalDescriptions: physicalDescriptions?.length
              ? {
                  create: physicalDescriptions.map(toPhysicalDescriptionCreate),
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
        });
      }
      return createdWork;
    });

    return this.findById(work.id, userId, context.organizationId);
  }

  async update(
    id: string,
    userId: string,
    data: WorkUpdateInput,
    headerValue?: OrganizationHeaderValue,
  ) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw resourceNotFound('Work');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    await this.prisma.work.update({
      where: { id },
      data: {
        title: data.title,
        subtitle: data.subtitle,
      },
    });

    return this.findById(id, userId, headerValue);
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw resourceNotFound('Work');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: work.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.externalIdentifier.deleteMany({
        where: { entityType: 'Work', entityId: id },
      });
      return tx.work.delete({
        where: { id },
        include: { organization: true, editions: true },
      });
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

function withEditionCoverUrls<T extends { editions: unknown[] }>(work: T) {
  return {
    ...work,
    editions: work.editions.map((edition) =>
      toEditionOutput(edition as Record<string, unknown>),
    ),
  };
}

function toEditionOutput(edition: Record<string, unknown>) {
  const editionCovers = edition.editionCovers as
    Array<{ id: string }> | undefined;
  const { editionCovers: _editionCovers, ...output } = edition;
  return new EditionOutputDto(output, Boolean(editionCovers?.length));
}
