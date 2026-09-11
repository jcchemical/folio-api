import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { isValidIsbn, normalizeIsbn } from './isbn.utils.js';
import type {
  CatalogueImportContributorDto,
  CatalogueImportDto,
  CatalogueImportResponseDto,
  CatalogueTitleInputDto,
} from './dto/catalogue-import.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { OrganizationRole } from '@prisma/client';
import { ContributionsService } from '../contributions/contributions.service.js';
import {
  derivePublicationProjection,
  normalizePublicationDateLiteral,
} from '../editions/dto/publication-statement.dto.js';
import { parsePorbaseResponse } from './porbase.parser.js';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

// Structural relations persisted for this import are always attributed to
// the PORBASE provider; only one provider exists today, and this is not a
// client-controllable value (mirrors the existing PublicationStatement
// precedent).
const PORBASE_SOURCE = 'PORBASE';

@Injectable()
export class PorbaseImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
    private readonly contributionsService: ContributionsService,
  ) {}

  async import(
    userId: string,
    input: CatalogueImportDto,
    providerId = 'porbase',
  ): Promise<Omit<CatalogueImportResponseDto, 'sourceId'>> {
    const isbn10 = normalizeOptionalIsbn(input.edition.isbn10);
    const isbn13 = normalizeOptionalIsbn(input.edition.isbn13);
    this.validateIsbn(isbn10, 'edition.isbn10');
    this.validateIsbn(isbn13, 'edition.isbn13');
    const organization = input.work.organizationId
      ? await this.organizationMemberships
          .assertRole(userId, input.work.organizationId, OrganizationRole.STAFF)
          .then((membership) => membership.organization)
      : await this.organizationMemberships.getDefaultOrganization(userId);
    if (!organization)
      throw new NotFoundException('Personal organization not found');

    return this.prisma.$transaction(async (transaction) => {
      await this.assertNoDuplicateEdition(
        transaction,
        organization.id,
        isbn10,
        isbn13,
      );

      const workTitleProjection = deriveMainTitle(
        input.work.titles,
        input.work.title,
        input.work.subtitle ?? null,
      );
      const work = await transaction.work.create({
        data: {
          title: workTitleProjection.title,
          subtitle: workTitleProjection.subtitle,
          organizationId: organization.id,
          titles: input.work.titles?.length
            ? { create: input.work.titles.map(toTitleCreate) }
            : undefined,
        },
      });

      const projection = input.edition.publicationStatements?.length
        ? derivePublicationProjection({
            statements: input.edition.publicationStatements,
          })
        : null;
      const hasPublicationStatements = Boolean(
        input.edition.publicationStatements?.length,
      );
      const editionTitleProjection = deriveMainTitle(
        input.edition.titles,
        input.edition.title,
        input.edition.subtitle ?? null,
      );
      const editionLanguageProjection = deriveTextLanguage(
        input.edition.languages,
        input.edition.language ?? null,
      );
      const edition = await transaction.edition.create({
        data: {
          title: editionTitleProjection.title,
          subtitle: editionTitleProjection.subtitle,
          isbn10,
          isbn13,
          publisher: hasPublicationStatements
            ? (projection?.publisher ?? null)
            : (input.edition.publisher ?? null),
          publicationDate: hasPublicationStatements
            ? (projection?.publicationDate ?? null)
            : (input.edition.publicationDate ?? null),
          publicationPlace: hasPublicationStatements
            ? (projection?.publicationPlace ?? null)
            : null,
          language: editionLanguageProjection,
          country: input.edition.country ?? null,
          format: input.edition.format ?? null,
          pageCount: derivePageCount(input.edition.physicalDescriptions),
          workId: work.id,
          titles: input.edition.titles?.length
            ? { create: input.edition.titles.map(toTitleCreate) }
            : undefined,
          responsibilityStatements: input.edition.responsibilityStatements
            ?.length
            ? {
                create: input.edition.responsibilityStatements.map(
                  (statement) => ({
                    label: statement.label,
                    value: statement.value,
                    sortOrder: statement.sortOrder,
                    source: PORBASE_SOURCE,
                  }),
                ),
              }
            : undefined,
          languages: input.edition.languages?.length
            ? {
                create: input.edition.languages.map((language) => ({
                  code: language.code,
                  role: language.role,
                  sortOrder: language.sortOrder,
                })),
              }
            : undefined,
          series: input.edition.series?.length
            ? {
                create: input.edition.series.map((series) => ({
                  title: series.title,
                  parallelTitle: series.parallelTitle ?? null,
                  volumeNumber: series.volumeNumber ?? null,
                  issn: series.issn ?? null,
                  sortOrder: series.sortOrder,
                  source: PORBASE_SOURCE,
                })),
              }
            : undefined,
          editionStatements: input.edition.editionStatements?.length
            ? {
                create: input.edition.editionStatements.map((statement) => ({
                  value: statement.value,
                  kind: statement.kind,
                  label: statement.label ?? null,
                  sortOrder: statement.sortOrder,
                  sourceTag: statement.sourceTag,
                })),
              }
            : undefined,
          notes: input.edition.notes?.length
            ? {
                create: input.edition.notes.map((note) => ({
                  type: note.type,
                  value: note.value,
                  sortOrder: note.sortOrder,
                  source: PORBASE_SOURCE,
                })),
              }
            : undefined,
          classifications: input.edition.classifications?.length
            ? {
                create: input.edition.classifications.map((classification) => ({
                  notation: classification.notation,
                  system: classification.system,
                  systemEdition: classification.systemEdition ?? null,
                  authorityId: classification.authorityId ?? null,
                  sortOrder: classification.sortOrder,
                  source: PORBASE_SOURCE,
                })),
              }
            : undefined,
          physicalDescriptions: input.edition.physicalDescriptions?.length
            ? {
                create: input.edition.physicalDescriptions.map(
                  (description) => ({
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
                  }),
                ),
              }
            : undefined,
          publicationStatements: input.edition.publicationStatements?.length
            ? {
                create: input.edition.publicationStatements.map(
                  (statement) => ({
                    sortOrder: statement.sortOrder,
                    indicator1: statement.indicator1 ?? ' ',
                    indicator2: statement.indicator2 ?? '9',
                    source: PORBASE_SOURCE,
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
                  }),
                ),
              }
            : undefined,
        } as Prisma.EditionCreateArgs['data'],
      });

      if (input.contributions?.length) {
        await this.contributionsService.persistPorbase(
          transaction,
          userId,
          work.id,
          input.contributions,
        );
      } else {
        await this.persistContributors(
          transaction,
          work.id,
          edition.id,
          input.contributors,
        );
      }

      await this.persistExternalIdentifiers(
        transaction,
        edition.id,
        organization.id,
        input.externalIdentifiers,
      );

      const unmappedFields = safeReparseUnmappedFields(
        input.bibliographicRecord.rawContent,
      );
      const bibliographicRecord = await transaction.bibliographicRecord.create({
        data: {
          format: input.bibliographicRecord.format,
          rawContent: input.bibliographicRecord.rawContent,
          // source/schema/sourceId are never client-controlled: only one
          // provider format exists today, and the provider identity is
          // supplied by the CatalogueProvider that authenticated the request.
          source: PORBASE_SOURCE,
          schema: 'UNIMARC',
          sourceId: providerId,
          remoteId: input.bibliographicRecord.remoteId ?? null,
          workId: work.id,
          editionId: edition.id,
          unmappedSourceFields: unmappedFields.length
            ? {
                create: unmappedFields.map((field) => ({
                  tag: field.tag,
                  indicator1: field.indicator1 ?? null,
                  indicator2: field.indicator2 ?? null,
                  occurrence: field.occurrence,
                  reason: field.reason,
                  subfields: {
                    create: field.subfields.map((subfield, sortOrder) => ({
                      code: subfield.code || '-',
                      value: subfield.value,
                      sortOrder,
                    })),
                  },
                })),
              }
            : undefined,
        },
        include: {
          unmappedSourceFields: {
            orderBy: [{ tag: 'asc' }, { occurrence: 'asc' }, { id: 'asc' }],
            include: {
              subfields: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            },
          },
        },
      });

      const item = await transaction.item.create({
        data: {
          label: input.item.label ?? null,
          location: input.item.location ?? null,
          status: input.item.status,
          notes: input.item.notes ?? null,
          editionId: edition.id,
          organizationId: organization.id,
        },
      });

      const persisted = await transaction.work.findUniqueOrThrow({
        where: { id: work.id },
        include: {
          organization: true,
          titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          editions: {
            include: {
              externalIdentifiers: true,
              bibliographicRecords: {
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                include: {
                  unmappedSourceFields: {
                    orderBy: [
                      { tag: 'asc' },
                      { occurrence: 'asc' },
                      { id: 'asc' },
                    ],
                    include: {
                      subfields: {
                        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                      },
                    },
                  },
                },
              },
              items: true,
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
              classifications: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              },
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
              editionContributors: { include: { contributor: true } },
              contributions: {
                include: {
                  agent: true,
                  sourceParts: {
                    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                  },
                },
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              },
            },
          },
          workContributors: { include: { contributor: true } },
          contributions: {
            include: {
              agent: true,
              sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
          bibliographicRecords: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: {
              unmappedSourceFields: {
                orderBy: [{ tag: 'asc' }, { occurrence: 'asc' }, { id: 'asc' }],
                include: {
                  subfields: {
                    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                  },
                },
              },
            },
          },
        },
      });

      const persistedEdition =
        persisted.editions.find(({ id }) => id === edition.id) ??
        persisted.editions[0];
      const editionContributors = persistedEdition.editionContributors.map(
        (relation) => ({
          id: relation.contributor.id,
          name: relation.contributor.name,
          role: relation.role,
          scope: 'EDITION' as const,
          sortOrder: relation.sortOrder,
        }),
      );
      const workContributors = persisted.workContributors.map((relation) => ({
        id: relation.contributor.id,
        name: relation.contributor.name,
        role: relation.role,
        scope: 'WORK' as const,
        sortOrder: relation.sortOrder,
      }));
      const canonicalEditionContributors = (
        persistedEdition.contributions ?? []
      ).map(toLegacyContributor);
      const canonicalWorkContributors = (persisted.contributions ?? []).map(
        toLegacyContributor,
      );
      const responseEdition = {
        ...persistedEdition,
        contributors: canonicalEditionContributors.length
          ? canonicalEditionContributors
          : editionContributors,
        contributions: (persistedEdition.contributions ?? []).map(
          toPersistedContribution,
        ),
      };

      return {
        id: persisted.id,
        work: {
          id: persisted.id,
          title: persisted.title,
          subtitle: persisted.subtitle,
          organization: persisted.organization,
          editions: [responseEdition],
          titles: persisted.titles,
          contributors: canonicalWorkContributors.length
            ? canonicalWorkContributors
            : workContributors,
          contributions: (persisted.contributions ?? []).map(
            toPersistedContribution,
          ),
          bibliographicRecords: persisted.bibliographicRecords,
        },
        edition: responseEdition,
        contributors: [
          ...(canonicalWorkContributors.length
            ? canonicalWorkContributors
            : workContributors),
          ...(canonicalEditionContributors.length
            ? canonicalEditionContributors
            : editionContributors),
        ],
        contributions: [
          ...(persisted.contributions ?? []).map(toPersistedContribution),
          ...(persistedEdition.contributions ?? []).map(
            toPersistedContribution,
          ),
        ],
        externalIdentifiers: responseEdition.externalIdentifiers,
        bibliographicRecord,
        item,
        warnings:
          projection?.warnings.map((warning) => ({
            code: warning.code,
            field: warning.field,
            message: warning.message,
            original: warning.original,
            normalized: warning.normalized,
            type:
              warning.type === 'validation_warning'
                ? 'parse_warning'
                : warning.type,
          })) ?? [],
      } satisfies Omit<CatalogueImportResponseDto, 'sourceId'>;
    });
  }

  private async assertNoDuplicateEdition(
    transaction: TransactionClient,
    organizationId: string,
    isbn10: string | null,
    isbn13: string | null,
  ): Promise<void> {
    const existing = isbn13
      ? await transaction.edition.findFirst({
          where: { isbn13, work: { organizationId } },
        })
      : isbn10
        ? await transaction.edition.findFirst({
            where: { isbn10, work: { organizationId } },
          })
        : null;

    if (existing) {
      throw new ConflictException(
        'An edition with this ISBN already exists for this organization',
      );
    }
  }

  private async persistContributors(
    transaction: TransactionClient,
    workId: string,
    editionId: string,
    inputs: CatalogueImportContributorDto[],
  ) {
    const persisted: Array<{
      id: string;
      name: string;
      role: string;
      scope: 'WORK' | 'EDITION';
      sortOrder: number;
    }> = [];

    for (const input of inputs) {
      const name = normalizeContributorName(input.name);
      const allContributors = await transaction.contributor.findMany();
      const contributor =
        allContributors.find(
          (candidate) => normalizeContributorName(candidate.name) === name,
        ) ??
        (await transaction.contributor.create({
          data: { name: input.name.trim(), variantNames: [] },
        }));
      const sortOrder = input.sortOrder ?? 0;

      if (input.scope === 'WORK') {
        await transaction.workContributor.create({
          data: {
            workId,
            contributorId: contributor.id,
            role: input.role,
            sortOrder,
          },
        });
      } else {
        await transaction.editionContributor.create({
          data: {
            editionId,
            contributorId: contributor.id,
            role: input.role,
            sortOrder,
          },
        });
      }

      persisted.push({
        id: contributor.id,
        name: contributor.name,
        role: input.role,
        scope: input.scope,
        sortOrder,
      });
    }

    return persisted;
  }

  private async persistExternalIdentifiers(
    transaction: TransactionClient,
    editionId: string,
    organizationId: string,
    inputs: CatalogueImportDto['externalIdentifiers'],
  ): Promise<void> {
    for (const input of inputs) {
      try {
        await transaction.externalIdentifier.create({
          data: {
            type: input.type,
            value: normalizeIdentifierValue(input.type, input.value),
            source: input.source ?? null,
            organizationId,
            editionId,
          },
        });
      } catch (error: unknown) {
        if (isPrismaUniqueViolation(error)) {
          throw new ConflictException(
            `External identifier ${input.type}:${input.value} already exists`,
          );
        }
        throw error;
      }
    }
  }

  private validateIsbn(value: string | null, field: string): void {
    if (value && !isValidIsbn(value)) {
      throw new BadRequestException(`${field} is not a valid ISBN`);
    }
  }
}

function toTitleCreate(title: CatalogueTitleInputDto) {
  return {
    type: title.type,
    value: title.value,
    subtitle: title.subtitle ?? null,
    language: title.language ?? null,
    sortOrder: title.sortOrder,
    source: PORBASE_SOURCE,
  };
}

function deriveMainTitle(
  titles: CatalogueTitleInputDto[] | undefined,
  fallbackTitle: string,
  fallbackSubtitle: string | null,
): { title: string; subtitle: string | null } {
  const main = [...(titles ?? [])]
    .filter((title) => title.type === 'MAIN')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!main) return { title: fallbackTitle, subtitle: fallbackSubtitle };
  return { title: main.value, subtitle: main.subtitle ?? null };
}

function deriveTextLanguage(
  languages: { code: string; role: string; sortOrder: number }[] | undefined,
  fallbackLanguage: string | null,
): string | null {
  const text = [...(languages ?? [])]
    .filter((language) => language.role === 'TEXT')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return text ? text.code : fallbackLanguage;
}

/**
 * Re-derives unmapped/local fields from the persisted rawContent so that
 * provenance the client cannot control (which datafields were left
 * unmapped) always matches what was actually stored. Best-effort: parse
 * failures never block the import, they simply yield no unmapped fields.
 */
function safeReparseUnmappedFields(rawContent: string): Array<{
  tag: string;
  indicator1: string | null;
  indicator2: string | null;
  occurrence: number;
  reason: string;
  subfields: Array<{ code: string; value: string }>;
}> {
  try {
    const result = parsePorbaseResponse('reparse', rawContent);
    return (result.metadata.unmappedFields ?? []).map((field) => ({
      tag: field.tag,
      indicator1: field.indicator1 ?? null,
      indicator2: field.indicator2 ?? null,
      occurrence: field.occurrence,
      reason: field.reason,
      subfields: field.subfields,
    }));
  } catch {
    return [];
  }
}

function toPersistedContribution(contribution: {
  id: string;
  sortOrder: number;
  source: string;
  roleLabel: string | null;
  relationshipCodeScheme: string | null;
  authorityId: string | null;
  sourceTag: string | null;
  indicator1: string | null;
  indicator2: string | null;
  workId: string | null;
  agent: { displayName: string; kind: string };
  sourceParts: Array<{ code: string; value: string; sortOrder: number }>;
}) {
  return {
    id: contribution.id,
    displayName: contribution.agent.displayName,
    kind: contribution.agent.kind,
    scope: contribution.workId ? ('WORK' as const) : ('EDITION' as const),
    sortOrder: contribution.sortOrder,
    source: contribution.source,
    roleLabel: contribution.roleLabel,
    relationshipCodeScheme: contribution.relationshipCodeScheme,
    authorityId: contribution.authorityId,
    sourceTag: contribution.sourceTag,
    indicator1: contribution.indicator1,
    indicator2: contribution.indicator2,
    sourceParts: contribution.sourceParts,
  };
}

function toLegacyContributor(contribution: {
  id: string;
  sortOrder: number;
  roleLabel: string | null;
  workId: string | null;
  agent: { displayName: string };
}) {
  return {
    id: contribution.id,
    name: contribution.agent.displayName,
    role: contribution.roleLabel ?? 'unclassified',
    scope: contribution.workId ? ('WORK' as const) : ('EDITION' as const),
    sortOrder: contribution.sortOrder,
  };
}

function derivePageCount(
  descriptions:
    CatalogueImportDto['edition']['physicalDescriptions'] | undefined,
): number | null {
  const candidates = (descriptions ?? [])
    .flatMap(({ parts }) => parts)
    .filter(({ subfield }) => subfield.toLowerCase() === 'a')
    .map(({ value }) => /^(\d+)\s*(?:p\.?|pages?)$/i.exec(value.trim())?.[1])
    .filter((value): value is string => Boolean(value));
  return candidates.length === 1 ? Number(candidates[0]) : null;
}

function normalizeOptionalIsbn(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return normalizeIsbn(value);
}

function normalizeIdentifierValue(type: string, value: string): string {
  return type.toUpperCase().startsWith('ISBN')
    ? normalizeIsbn(value)
    : value.trim();
}

function normalizeContributorName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
