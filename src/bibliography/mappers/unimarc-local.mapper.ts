import type {
  BibliographicExportWarning,
  MarcDataField,
  MarcMappingResult,
  MarcRecord,
} from '../marc-record.types.js';
import { validateMarcRecord } from '../marc-record.validation.js';

/** Provisional 24-character leader for the initial local UNIMARC subset. */
export const PROVISIONAL_UNIMARC_LEADER = '00000nam a2200000 a 4500';

export type LocalContributorLink = {
  role: string;
  sortOrder: number;
  contributor: {
    name: string;
  };
};

export type LocalExternalIdentifier = {
  type: string;
  value: string;
};

export type LocalPhysicalDescription = {
  sortOrder: number;
  parts: Array<{
    subfield: string;
    value: string;
    sortOrder: number;
  }>;
};

export type LocalPublicationStatement = {
  sortOrder: number;
  indicator1: string;
  indicator2: string;
  parts: Array<{ subfield: string; value: string; sortOrder: number }>;
};

export type UnimarcLocalEditionInput = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publisher?: string | null;
  publicationDate?: string | null;
  publicationPlace?: string | null;
  language?: string | null;
  pageCount?: number | null;
  physicalDescriptions?: LocalPhysicalDescription[];
  publicationStatements?: LocalPublicationStatement[];
  work?: {
    title?: string | null;
  } | null;
  editionContributors?: LocalContributorLink[];
  workContributors?: LocalContributorLink[];
  externalIdentifiers?: LocalExternalIdentifier[];
};

/**
 * Maps persisted local edition data to the initial UNIMARC subset.
 * BibliographicRecord.rawContent and remote identifiers are intentionally not
 * part of this input: local export starts from the corrected local model.
 */
export function mapLocalEditionToUnimarc(
  edition: UnimarcLocalEditionInput,
): MarcMappingResult {
  const warnings: BibliographicExportWarning[] = [];
  const dataFields: MarcDataField[] = [];

  const isbnSubfields = [
    createOptionalSubfield('a', edition.isbn10),
    createOptionalSubfield('a', edition.isbn13),
  ].filter((subfield): subfield is { code: 'a'; value: string } => Boolean(subfield));

  if (isbnSubfields.length > 0) {
    dataFields.push({
      tag: '010',
      indicator1: ' ',
      indicator2: ' ',
      subfields: isbnSubfields,
    });
  }

  const language = createOptionalSubfield('a', edition.language);
  if (language) {
    dataFields.push({
      tag: '101',
      indicator1: '0',
      indicator2: ' ',
      subfields: [language],
    });
  } else {
    warnings.push({
      field: '101$a',
      code: 'missing_required_data',
      message: 'Edition language is missing; 101$a was not generated.',
    });
  }

  const title = firstNonEmpty(edition.title, edition.work?.title);
  const titleSubfield = createOptionalSubfield('a', title);
  const subtitleSubfield = createOptionalSubfield('e', edition.subtitle);

  if (titleSubfield) {
    dataFields.push({
      tag: '200',
      indicator1: '1',
      indicator2: ' ',
      subfields: [
        titleSubfield,
        ...(subtitleSubfield ? [subtitleSubfield] : []),
      ],
    });
  } else {
    warnings.push({
      field: '200$a',
      code: 'missing_required_data',
      message: 'Neither the edition title nor Work.title is available; 200$a was not generated.',
    });
  }

  const publicationStatements = [...(edition.publicationStatements ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder);
  if (publicationStatements.length > 0) {
    for (const statement of publicationStatements) {
      const subfields = [...statement.parts]
        .filter(({ subfield, value }) => /^[a-z0-9]$/.test(subfield) && isNonEmpty(value))
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map(({ subfield, value }) => ({ code: subfield, value }));
      if (subfields.length > 0) dataFields.push({ tag: '210', indicator1: statement.indicator1, indicator2: statement.indicator2, subfields });
    }
  } else {
    const publicationSubfields = [
      createOptionalSubfield('a', edition.publicationPlace),
      createOptionalSubfield('c', edition.publisher),
      createOptionalSubfield('d', serializePublishDate(edition.publicationDate)),
    ].filter((subfield): subfield is { code: 'a' | 'c' | 'd'; value: string } => Boolean(subfield));
    if (publicationSubfields.length > 0) dataFields.push({ tag: '210', indicator1: ' ', indicator2: ' ', subfields: publicationSubfields });
  }

  const physicalDescriptions = [...(edition.physicalDescriptions ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder);
  if (physicalDescriptions.length > 0) {
    for (const description of physicalDescriptions) {
      const subfields = [...description.parts]
        .filter(({ subfield, value }) => /^[a-z0-9]$/.test(subfield) && isNonEmpty(value))
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map(({ subfield, value }) => ({ code: subfield, value }));
      if (subfields.length === 0) continue;
      dataFields.push({
        tag: '215',
        indicator1: ' ',
        indicator2: ' ',
        subfields,
      });
    }
  } else {
    const pageCount = edition.pageCount;
    if (typeof pageCount === 'number' && Number.isInteger(pageCount) && pageCount > 0) {
      dataFields.push({
        tag: '215',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: `${pageCount} p.` }],
      });
    }
  }

  appendContributorFields(edition, dataFields, warnings);
  appendExternalIdentifierWarnings(edition.externalIdentifiers, warnings);

  const record: MarcRecord = {
    leader: PROVISIONAL_UNIMARC_LEADER,
    controlFields: [{ tag: '001', value: edition.id }],
    dataFields,
  };

  validateMarcRecord(record);

  return { record, warnings };
}

function appendContributorFields(
  edition: UnimarcLocalEditionInput,
  dataFields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  const contributors = [
    ...(edition.editionContributors ?? []),
    ...(edition.workContributors ?? []),
  ]
    .map((link, index) => ({ link, index }))
    .sort((left, right) => left.link.sortOrder - right.link.sortOrder || left.index - right.index)
    .map(({ link }) => link);

  const authors = contributors.filter(
    ({ role, contributor }) => role.toLowerCase() === 'author' && isNonEmpty(contributor.name),
  );

  authors.forEach((author, index) => {
    dataFields.push({
      tag: index === 0 ? '700' : '701',
      indicator1: ' ',
      indicator2: ' ',
      subfields: [{ code: 'a', value: author.contributor.name }],
    });
  });

  contributors
    .filter(({ role }) => role.toLowerCase() !== 'author')
    .forEach(({ role, contributor }) => {
      if (!isNonEmpty(contributor.name)) {
        warnings.push({
          field: 'contributor',
          code: 'unmapped_data',
          message: `Contributor with role "${role}" has no name and was not mapped.`,
        });
        return;
      }

      // No role-to-UNIMARC function-code mapping exists in the current code.
      warnings.push({
        field: '702$a',
        code: 'unmapped_data',
        message: `Contributor role "${role}" has no safe UNIMARC function mapping; 702$a was not generated.`,
        sourceValue: contributor.name,
      });
    });
}

function appendExternalIdentifierWarnings(
  identifiers: LocalExternalIdentifier[] | undefined,
  warnings: BibliographicExportWarning[],
): void {
  for (const identifier of identifiers ?? []) {
    warnings.push({
      field: 'externalIdentifier',
      code: 'unmapped_data',
      message: `External identifier type "${identifier.type}" is not mapped in the initial UNIMARC subset.`,
      sourceValue: identifier.value,
    });
  }
}

function createOptionalSubfield<Code extends string>(
  code: Code,
  value: string | null | undefined,
): { code: Code; value: string } | undefined {
  return isNonEmpty(value) ? { code, value } : undefined;
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | undefined {
  return values.find(isNonEmpty);
}

function isNonEmpty(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.trim().length > 0;
}

function serializePublishDate(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? undefined;
}
