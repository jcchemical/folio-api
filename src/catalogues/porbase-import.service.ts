import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { isValidIsbn, normalizeIsbn } from './isbn.utils.js';
import type {
  PorbaseImportContributorDto,
  PorbaseImportDto,
  PorbaseImportResponseDto,
} from './dto/porbase-import.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { OrganizationRole } from '@prisma/client';
import { ContributionsService } from '../contributions/contributions.service.js';
import { derivePublicationProjection, normalizePublicationDateLiteral } from '../editions/dto/publication-statement.dto.js';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

@Injectable()
export class PorbaseImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
    private readonly contributionsService: ContributionsService,
  ) {}

  async import(
    userId: string,
    input: PorbaseImportDto,
  ): Promise<PorbaseImportResponseDto> {
    const isbn10 = normalizeOptionalIsbn(input.edition.isbn10);
    const isbn13 = normalizeOptionalIsbn(input.edition.isbn13);
    this.validateIsbn(isbn10, 'edition.isbn10');
    this.validateIsbn(isbn13, 'edition.isbn13');
    const organization = input.work.organizationId
      ? await this.organizationMemberships.assertRole(
          userId,
          input.work.organizationId,
          OrganizationRole.STAFF,
        ).then((membership) => membership.organization)
      : await this.organizationMemberships.getDefaultOrganization(userId);
    if (!organization) throw new NotFoundException('Personal organization not found');

    return this.prisma.$transaction(async (transaction) => {
      await this.assertNoDuplicateEdition(transaction, organization.id, isbn10, isbn13);

      const work = await transaction.work.create({
        data: {
          title: input.work.title,
          subtitle: input.work.subtitle ?? null,
          organizationId: organization.id,
        },
      });

      const projection = input.edition.publicationStatements?.length
        ? derivePublicationProjection({ statements: input.edition.publicationStatements })
        : null;
      const hasPublicationStatements = Boolean(input.edition.publicationStatements?.length);
      const edition = await transaction.edition.create({
        data: {
          title: input.edition.title,
          subtitle: input.edition.subtitle ?? null,
          isbn10,
          isbn13,
          publisher: hasPublicationStatements ? projection?.publisher ?? null : input.edition.publisher ?? null,
          publicationDate: hasPublicationStatements ? projection?.publicationDate ?? null : input.edition.publicationDate ?? null,
          publicationPlace: hasPublicationStatements ? projection?.publicationPlace ?? null : null,
          language: input.edition.language ?? null,
          country: input.edition.country ?? null,
          format: input.edition.format ?? null,
          pageCount: derivePageCount(input.edition.physicalDescriptions),
          workId: work.id,
          physicalDescriptions: input.edition.physicalDescriptions?.length
            ? {
                create: input.edition.physicalDescriptions.map((description) => ({
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
                })),
              }
            : undefined,
          publicationStatements: input.edition.publicationStatements?.length
            ? { create: input.edition.publicationStatements.map((statement) => ({
                sortOrder: statement.sortOrder,
                indicator1: statement.indicator1 ?? ' ',
                indicator2: statement.indicator2 ?? '9',
                source: 'PORBASE',
                parts: { create: statement.parts.map((part) => ({
                  subfield: part.subfield.toLowerCase(), value: part.value.trim(), sortOrder: part.sortOrder, normalizedValue: part.subfield.toLowerCase() === 'd' ? normalizePublicationDateLiteral(part.value.trim()) : null,
                })) },
              })) }
            : undefined,
          } as Prisma.EditionCreateArgs['data'],
      });

      if (input.contributions?.length) {
        await this.contributionsService.persistPorbase(transaction, userId, work.id, input.contributions);
      } else {
        await this.persistContributors(transaction, work.id, edition.id, input.contributors);
      }

      await this.persistExternalIdentifiers(
        transaction,
        edition.id,
        organization.id,
        input.externalIdentifiers,
      );

      const bibliographicRecord = await transaction.bibliographicRecord.create({
        data: {
          format: input.bibliographicRecord.format,
          rawContent: input.bibliographicRecord.rawContent,
          source: input.bibliographicRecord.source,
          remoteId: input.bibliographicRecord.remoteId ?? null,
          workId: work.id,
          editionId: edition.id,
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
          editions: {
            include: {
              externalIdentifiers: true,
              bibliographicRecords: true,
              items: true,
              physicalDescriptions: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                include: {
                  parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
                },
              },
              publicationStatements: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
              },
              editionContributors: { include: { contributor: true } },
              contributions: { include: { agent: true, sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            },
          },
          workContributors: { include: { contributor: true } },
          contributions: { include: { agent: true, sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          bibliographicRecords: true,
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
      const canonicalEditionContributors = (persistedEdition.contributions ?? [])
        .map(toLegacyContributor);
      const canonicalWorkContributors = (persisted.contributions ?? [])
        .map(toLegacyContributor);
      const responseEdition = {
        ...persistedEdition,
        contributors: canonicalEditionContributors.length ? canonicalEditionContributors : editionContributors,
        contributions: (persistedEdition.contributions ?? []).map(toPersistedContribution),
      };

      return {
        id: persisted.id,
        work: {
          id: persisted.id,
          title: persisted.title,
          subtitle: persisted.subtitle,
          organization: persisted.organization,
          editions: [responseEdition],
          contributors: canonicalWorkContributors.length ? canonicalWorkContributors : workContributors,
          contributions: (persisted.contributions ?? []).map(toPersistedContribution),
          bibliographicRecords: persisted.bibliographicRecords,
        },
        edition: responseEdition,
        contributors: [
          ...(canonicalWorkContributors.length ? canonicalWorkContributors : workContributors),
          ...(canonicalEditionContributors.length ? canonicalEditionContributors : editionContributors),
        ],
        contributions: [...(persisted.contributions ?? []).map(toPersistedContribution), ...(persistedEdition.contributions ?? []).map(toPersistedContribution)],
        externalIdentifiers: responseEdition.externalIdentifiers,
        bibliographicRecord,
        item,
        warnings: projection?.warnings.map((warning) => ({
          code: warning.code,
          field: warning.field,
          message: warning.message,
          original: warning.original,
          normalized: warning.normalized,
          type: warning.type === 'validation_warning' ? 'parse_warning' : warning.type,
        })) ?? [],
      } satisfies PorbaseImportResponseDto;
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
    inputs: PorbaseImportContributorDto[],
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
    inputs: PorbaseImportDto['externalIdentifiers'],
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

function toPersistedContribution(contribution: { id: string; sortOrder: number; source: string; roleLabel: string | null; relationshipCodeScheme: string | null; sourceTag: string | null; indicator1: string | null; indicator2: string | null; workId: string | null; agent: { displayName: string; kind: string }; sourceParts: Array<{ code: string; value: string; sortOrder: number }> }) {
  return { id: contribution.id, displayName: contribution.agent.displayName, kind: contribution.agent.kind, scope: contribution.workId ? 'WORK' as const : 'EDITION' as const, sortOrder: contribution.sortOrder, source: contribution.source, roleLabel: contribution.roleLabel, relationshipCodeScheme: contribution.relationshipCodeScheme, sourceTag: contribution.sourceTag, indicator1: contribution.indicator1, indicator2: contribution.indicator2, sourceParts: contribution.sourceParts };
}

function toLegacyContributor(contribution: { id: string; sortOrder: number; roleLabel: string | null; workId: string | null; agent: { displayName: string } }) {
  return {
    id: contribution.id,
    name: contribution.agent.displayName,
    role: contribution.roleLabel ?? 'unclassified',
    scope: contribution.workId ? 'WORK' as const : 'EDITION' as const,
    sortOrder: contribution.sortOrder,
  };
}

function derivePageCount(
  descriptions: PorbaseImportDto['edition']['physicalDescriptions'] | undefined,
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
