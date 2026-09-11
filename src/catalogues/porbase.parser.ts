import { XMLParser } from 'fast-xml-parser';
import {
  PorbaseBibliographicFieldsDto,
  PorbaseDetectedFormat,
  PorbaseSearchResponseDto,
} from './dto/porbase-search-response.dto.js';
import {
  CatalogueWarningDto,
  CatalogueWarningCode,
  CatalogueWarningType,
} from './dto/catalogue-warning.dto.js';
import type { CataloguePublicationStatementDto } from './dto/catalogue-publication-statement.dto.js';
import type { CatalogueTitleDto } from './dto/catalogue-title.dto.js';
import type { CatalogueResponsibilityStatementDto } from './dto/catalogue-responsibility-statement.dto.js';
import type { CatalogueLanguageDto } from './dto/catalogue-language.dto.js';
import type { CatalogueSeriesDto } from './dto/catalogue-series.dto.js';
import type { CatalogueNoteDto } from './dto/catalogue-note.dto.js';
import type { CatalogueClassificationDto } from './dto/catalogue-classification.dto.js';
import type { CatalogueUnmappedFieldDto } from './dto/catalogue-unmapped-field.dto.js';
import type { CatalogueEditionStatementDto } from './dto/catalogue-edition-statement.dto.js';
import type { CatalogueSourceIdentifierDto } from './dto/catalogue-source-identifier.dto.js';
import type { CatalogueResourceType } from './dto/porbase-search-response.dto.js';
import { PorbaseXmlError } from './catalogues.types.js';
import { isValidBibliographicDate } from '../common/bibliographic-date.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export function parsePorbaseResponse(
  query: string,
  rawContent: string,
  contentType?: string,
): PorbaseSearchResponseDto {
  const trimmed = rawContent.trim();

  if (!trimmed) {
    return buildResponse(query, rawContent, 'UNKNOWN', false, {
      warnings: [
        warning(
          'PORBASE returned an empty response.',
          'provider_error',
          undefined,
          'PORBASE_EMPTY_RESPONSE',
        ),
      ],
    });
  }

  if (isErrorMessage(trimmed)) {
    return buildResponse(query, rawContent, 'ERROR', false, {
      warnings: [
        warning(
          'PORBASE returned an error message instead of a record.',
          'provider_error',
        ),
      ],
    });
  }

  if (looksLikeXml(trimmed, contentType)) {
    return parseXmlResponse(query, rawContent);
  }

  if (looksLikeMarcText(trimmed)) {
    return parseMarcTextResponse(query, rawContent);
  }

  return buildResponse(query, rawContent, 'UNKNOWN', false, {
    warnings: [
      warning(
        'PORBASE returned content whose format could not be identified safely.',
        'parse_error',
      ),
    ],
  });
}

export function notFoundResponse(
  query: string,
  rawContent = '',
  contentType?: string,
): PorbaseSearchResponseDto {
  const trimmed = rawContent.trim();
  const detectedFormat = isErrorMessage(trimmed)
    ? 'ERROR'
    : trimmed
      ? detectFormat(rawContent, contentType)
      : 'UNKNOWN';

  return buildResponse(query, rawContent, detectedFormat, false, {
    warnings: [
      warning(
        'No PORBASE record was found.',
        'provider_error',
        undefined,
        'PORBASE_RECORD_NOT_FOUND',
      ),
    ],
  });
}

function parseXmlResponse(
  query: string,
  rawContent: string,
): PorbaseSearchResponseDto {
  let document: unknown;
  try {
    document = xmlParser.parse(rawContent);
  } catch {
    throw new PorbaseXmlError('PORBASE returned malformed XML');
  }

  const error = findText(findFirstValue(document, 'error'));
  if (error) {
    return buildResponse(query, rawContent, 'ERROR', false, {
      warnings: [warning(`PORBASE error: ${error}`, 'provider_error')],
    });
  }

  const record = findFirstObject(document, 'record');
  if (!record) {
    throw new PorbaseXmlError('PORBASE XML did not contain a MARC record');
  }

  const warnings: CatalogueWarningDto[] = [];
  const metadata = extractXmlMetadata(record, warnings);
  return buildResponse(query, rawContent, 'MARCXCHANGE_XML', true, {
    format: textValue(record['@_format']) ?? 'Unimarc',
    schema: 'UNIMARC',
    metadata,
    warnings,
  });
}

function parseMarcTextResponse(
  query: string,
  rawContent: string,
): PorbaseSearchResponseDto {
  const warnings: CatalogueWarningDto[] = [];
  const fields = parseMarcTextFields(rawContent, warnings);
  const metadata = extractTextMetadata(fields, warnings);

  return buildResponse(query, rawContent, 'MARC_TEXT', true, {
    format: 'MARC',
    schema: 'UNIMARC',
    metadata,
    warnings,
  });
}

interface TextField {
  tag: string;
  indicator1: string;
  indicator2: string;
  value: string;
  subfields: Map<string, string[]>;
  orderedSubfields: Array<{ code: string; value: string }>;
}

function parseMarcTextFields(
  rawContent: string,
  warnings: CatalogueWarningDto[],
): TextField[] {
  const fields: TextField[] = [];
  for (const [index, line] of rawContent.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = /^(\d{3})(?:\s+|[:|])?(.*)$/.exec(trimmed);
    if (!match) {
      warnings.push(
        warning(
          `Ignored MARC text line ${index + 1}: field tag not found.`,
          'parse_warning',
        ),
      );
      continue;
    }

    const [, tag, remainder] = match;
    const subfields = new Map<string, string[]>();
    const orderedSubfields: Array<{ code: string; value: string }> = [];
    const subfieldMatches = [...remainder.matchAll(/\$([a-z0-9])\s*([^$]*)/gi)];
    for (const subfield of subfieldMatches) {
      const [, code, value] = subfield;
      const values = subfields.get(code.toLowerCase()) ?? [];
      const trimmedValue = value.trim();
      values.push(trimmedValue);
      subfields.set(code.toLowerCase(), values);
      orderedSubfields.push({ code: code.toLowerCase(), value: trimmedValue });
    }

    const value = subfieldMatches.length
      ? ''
      : remainder.replace(/^[#| ]+/, '').trim();
    if (!value && subfieldMatches.length === 0) {
      warnings.push(
        warning(
          `MARC text line ${index + 1} has no readable value.`,
          'parse_warning',
        ),
      );
    }
    fields.push({
      tag,
      indicator1: ' ',
      indicator2: ' ',
      value,
      subfields,
      orderedSubfields,
    });
  }
  return fields;
}

function extractTextMetadata(
  fields: TextField[],
  warnings: CatalogueWarningDto[],
): PorbaseBibliographicFieldsDto {
  const metadata: PorbaseBibliographicFieldsDto = {
    authors: [],
    translators: [],
    sourceIdentifiers: [],
    titles: [],
    responsibilityStatements: [],
    languages: [],
    editionStatements: [],
    resourceType: 'UNSPECIFIED',
    series: [],
    notes: [],
    classifications: [],
    unmappedFields: [],
  };

  metadata.recordId = firstValue(fields, '001');
  metadata.sourceIdentifiers = extractSourceIdentifiersFromText(fields);
  metadata.isbn = firstSubfieldValue(fields, '010', 'a');
  metadata.language = firstSubfieldValue(fields, '101', 'a');
  metadata.country = firstSubfieldValue(fields, '102', 'a');
  metadata.title = firstSubfieldValue(fields, '200', 'a');
  metadata.titles = extractTitlesFromText(fields);
  metadata.responsibilityStatements = extractResponsibilitiesFromText(fields);
  metadata.languages = extractLanguagesFromText(fields);
  metadata.editionStatements = extractEditionStatementsFromText(fields);
  metadata.generalMaterialDesignation = firstSubfieldValue(fields, '200', 'b');
  metadata.resourceType = resourceTypeFor(metadata.generalMaterialDesignation);
  metadata.placeOfPublication = firstSubfieldValue(fields, '210', 'a');
  metadata.publisher = firstSubfieldValue(fields, '210', 'c');
  metadata.publicationDate = normalizePublicationDate(
    firstSubfieldValue(fields, '210', 'd'),
    warnings,
  );
  metadata.extent = firstSubfieldValue(fields, '215', 'a');
  metadata.physicalDescriptions = extractTextPhysicalDescriptions(fields);
  metadata.publicationStatements = extractTextPublicationStatements(
    fields,
    warnings,
  );
  metadata.series = extractSeriesFromText(fields);
  metadata.notes = extractNotesFromText(fields);
  metadata.classifications = extractClassificationsFromText(fields);

  const authorFields = fields.filter((field) =>
    ['700', '701'].includes(field.tag),
  );
  metadata.authors = authorFields
    .map((field) => contributorName(field))
    .filter((value): value is string => Boolean(value));

  const translatorFields = fields.filter(
    (field) => field.tag === '702' && field.subfields.get('4')?.includes('730'),
  );
  metadata.translators = translatorFields
    .map((field) => contributorName(field))
    .filter((value): value is string => Boolean(value));
  metadata.contributions = extractTextContributions(fields);

  const responsibilityAuthor = firstSubfieldValue(fields, '200', 'f');
  if (metadata.authors.length === 0 && responsibilityAuthor) {
    metadata.authors = [responsibilityAuthor];
    warnings.push(
      warning(
        'Author was taken from 200$f because no 700/701 author field was available.',
        'parse_warning',
      ),
    );
  }

  const responsibilityTranslator = firstSubfieldValue(fields, '200', 'g');
  if (metadata.translators.length === 0 && responsibilityTranslator) {
    const translator = extractTranslatorName(responsibilityTranslator);
    if (translator) {
      metadata.translators = [translator];
    } else {
      warnings.push(
        warning(
          'A 200$g responsibility statement was present but could not be classified safely as a translator.',
          'parse_warning',
        ),
      );
    }
  }

  metadata.unmappedFields = collectUnmappedTextFields(fields);

  if (!metadata.title) {
    warnings.push(
      warning(
        'No unambiguous title field was found in the MARC text.',
        'missing_field',
        'work.title',
      ),
    );
  }
  if (
    fields.some((field) => field.tag === '200' && field.subfields.size === 0)
  ) {
    warnings.push(
      warning(
        'The 200 field had no visible subfield markers.',
        'parse_warning',
      ),
    );
  }

  return metadata;
}

function extractXmlMetadata(
  record: XmlObject,
  warnings: CatalogueWarningDto[],
): PorbaseBibliographicFieldsDto {
  const metadata: PorbaseBibliographicFieldsDto = {
    authors: [],
    translators: [],
    sourceIdentifiers: [],
    titles: [],
    responsibilityStatements: [],
    languages: [],
    editionStatements: [],
    resourceType: 'UNSPECIFIED',
    series: [],
    notes: [],
    classifications: [],
    unmappedFields: [],
  };

  metadata.recordId = firstControlfield(record, '001');
  metadata.sourceIdentifiers = extractSourceIdentifiersFromXml(record);
  metadata.isbn = firstSubfield(record, '010', 'a');
  metadata.language = firstSubfield(record, '101', 'a');
  metadata.country = firstSubfield(record, '102', 'a');
  metadata.title = firstSubfield(record, '200', 'a');
  metadata.titles = extractTitlesFromXml(record);
  metadata.responsibilityStatements = extractResponsibilitiesFromXml(record);
  metadata.languages = extractLanguagesFromXml(record);
  metadata.editionStatements = extractEditionStatementsFromXml(record);
  metadata.generalMaterialDesignation = firstSubfield(record, '200', 'b');
  metadata.resourceType = resourceTypeFor(metadata.generalMaterialDesignation);
  metadata.placeOfPublication = firstSubfield(record, '210', 'a');
  metadata.publisher = firstSubfield(record, '210', 'c');
  metadata.publicationDate = normalizePublicationDate(
    firstSubfield(record, '210', 'd'),
    warnings,
  );
  metadata.extent = firstSubfield(record, '215', 'a');
  metadata.physicalDescriptions = extractXmlPhysicalDescriptions(record);
  metadata.publicationStatements = extractXmlPublicationStatements(
    record,
    warnings,
  );
  metadata.series = extractSeriesFromXml(record);
  metadata.notes = extractNotesFromXml(record);
  metadata.classifications = extractClassificationsFromXml(record);

  metadata.authors = ['700', '701']
    .flatMap((tag) => datafields(record, tag).map(contributorNameFromXml))
    .filter((value): value is string => Boolean(value));
  metadata.translators = datafields(record, '702')
    .filter((field) => subfieldValues(field, '4').includes('730'))
    .map(contributorNameFromXml)
    .filter((value): value is string => Boolean(value));
  metadata.contributions = extractXmlContributions(record);

  const statementTranslator = firstSubfield(record, '200', 'g');
  if (metadata.translators.length === 0 && statementTranslator) {
    const translator = extractTranslatorName(statementTranslator);
    if (translator) metadata.translators = [translator];
  }

  metadata.unmappedFields = collectUnmappedXmlFields(record);

  return metadata;
}

function buildResponse(
  query: string,
  rawContent: string,
  detectedFormat: PorbaseDetectedFormat,
  found: boolean,
  options: {
    format?: string;
    schema?: string;
    metadata?: PorbaseBibliographicFieldsDto;
    warnings: CatalogueWarningDto[];
  },
): PorbaseSearchResponseDto {
  const metadata = options.metadata ?? emptyMetadata();
  return {
    source: 'PORBASE',
    query,
    found,
    detectedFormat,
    format: options.format ?? 'Unknown',
    schema: options.schema ?? 'UNIMARC',
    metadata,
    fields: metadata,
    warnings: options.warnings,
    rawContent,
  };
}

function normalizePublicationDate(
  value: string | undefined,
  warnings: CatalogueWarningDto[],
): string | null | undefined {
  if (!value) return undefined;

  const original = value.trim();
  const match = /^(?:D\.?\s*L\.?\s*)?(\d{4})[.?]?$/.exec(original);
  if (!match) {
    warnings.push({
      code: 'PORBASE_PARSE_ERROR',
      field: 'edition.publicationDate',
      message: `Não foi possível extrair data de '${original}'`,
      original,
      type: 'parse_error',
    });
    return null;
  }

  const normalized = match[1];
  if (original !== normalized) {
    warnings.push({
      code: 'PORBASE_NORMALIZATION',
      field: 'edition.publicationDate',
      message: `Data normalizada de '${original}' para '${normalized}'`,
      original,
      normalized,
      type: 'normalization',
    });
  }
  return normalized;
}

function warning(
  message: string,
  type: CatalogueWarningType,
  field?: string,
  codeOverride?: CatalogueWarningCode,
): CatalogueWarningDto {
  return { code: codeOverride ?? warningCode(type), field, message, type };
}

function warningCode(type: CatalogueWarningType): CatalogueWarningCode {
  switch (type) {
    case 'normalization':
      return 'PORBASE_NORMALIZATION';
    case 'missing_field':
      return 'PORBASE_MISSING_FIELD';
    case 'provider_error':
      return 'PORBASE_PROVIDER_ERROR';
    case 'parse_warning':
      return 'PORBASE_PARSE_WARNING';
    case 'parse_error':
      return 'PORBASE_PARSE_ERROR';
  }
}

function emptyMetadata(): PorbaseBibliographicFieldsDto {
  return {
    authors: [],
    translators: [],
    sourceIdentifiers: [],
    titles: [],
    responsibilityStatements: [],
    languages: [],
    editionStatements: [],
    resourceType: 'UNSPECIFIED',
    series: [],
    notes: [],
    classifications: [],
    unmappedFields: [],
    physicalDescriptions: [],
  };
}

function extractTitlesFromText(fields: TextField[]): CatalogueTitleDto[] {
  const titles: CatalogueTitleDto[] = [];
  for (const field of fields) {
    const values = field.subfields;
    if (field.tag === '200') {
      const mainValues = values.get('a') ?? [];
      mainValues.forEach((value, index) =>
        titles.push({
          type: index === 0 ? 'MAIN' : 'OTHER',
          value,
          sortOrder: titles.length,
          sourceTag: '200',
        }),
      );
      pushTitleSubfields(titles, values, 'd', 'PARALLEL', '200');
      pushTitleSubfields(titles, values, 'e', 'OTHER', '200');
      pushTitleSubfields(titles, values, 'h', 'OTHER', '200', 'partNumber');
      pushTitleSubfields(titles, values, 'i', 'OTHER', '200', 'partName');
    } else if (isVariantTitleTag(field.tag)) {
      (values.get('a') ?? []).forEach((value) =>
        titles.push({
          type: 'VARIANT',
          value,
          sortOrder: titles.length,
          sourceTag: field.tag,
        }),
      );
      (values.get('e') ?? []).forEach((value) =>
        titles.push({
          type: 'VARIANT',
          value,
          sortOrder: titles.length,
          sourceTag: field.tag,
        }),
      );
    }
  }
  return titles;
}

function pushTitleSubfields(
  titles: CatalogueTitleDto[],
  values: Map<string, string[]>,
  code: string,
  type: CatalogueTitleDto['type'],
  sourceTag: string,
  property?: 'partNumber' | 'partName',
): void {
  (values.get(code) ?? []).forEach((value) => {
    titles.push({
      type,
      value,
      sortOrder: titles.length,
      sourceTag,
      ...(property ? { [property]: value } : {}),
    } as CatalogueTitleDto);
  });
}

function extractTitlesFromXml(record: XmlObject): CatalogueTitleDto[] {
  return extractTitlesFromText(datafields(record).map(toTextField));
}

function isVariantTitleTag(tag: string): boolean {
  const number = Number(tag);
  return (number >= 510 && number <= 545) || tag === '500' || tag === '560';
}

function extractResponsibilitiesFromText(
  fields: TextField[],
): CatalogueResponsibilityStatementDto[] {
  return fields
    .filter(({ tag }) => tag === '200')
    .flatMap((field) =>
      ['f', 'g'].flatMap((code) =>
        (field.subfields.get(code) ?? []).map((value) => ({
          label:
            code === 'f'
              ? ('STATEMENT' as const)
              : ('SUBSEQUENT_STATEMENT' as const),
          value,
          sortOrder: 0,
          sourceTag: '200',
        })),
      ),
    )
    .map((statement, sortOrder) => ({ ...statement, sortOrder }));
}

function extractResponsibilitiesFromXml(
  record: XmlObject,
): CatalogueResponsibilityStatementDto[] {
  return extractResponsibilitiesFromText(datafields(record).map(toTextField));
}

function extractLanguagesFromText(fields: TextField[]): CatalogueLanguageDto[] {
  return fields
    .filter(({ tag }) => tag === '101')
    .flatMap((field) => [
      ...(field.subfields.get('a') ?? []).map((code) => ({
        code,
        role: 'TEXT' as const,
        sortOrder: 0,
      })),
      ...(field.subfields.get('c') ?? []).map((code) => ({
        code,
        role: 'ORIGINAL_LANGUAGE' as const,
        sortOrder: 0,
        sourceCode: '101$c',
      })),
    ])
    .map((language, sortOrder) => ({ ...language, sortOrder }));
}

function extractLanguagesFromXml(record: XmlObject): CatalogueLanguageDto[] {
  return extractLanguagesFromText(datafields(record, '101').map(toTextField));
}

function extractEditionStatementsFromText(
  fields: TextField[],
): CatalogueEditionStatementDto[] {
  return fields
    .filter(({ tag }) => tag === '205')
    .flatMap((field) =>
      ['a', 'b', 'f'].flatMap((code) =>
        (field.subfields.get(code) ?? []).map((value) => ({
          value,
          sortOrder: 0,
          sourceCode: `205$${code}`,
        })),
      ),
    )
    .map((statement, sortOrder) => ({ ...statement, sortOrder }));
}

function extractEditionStatementsFromXml(
  record: XmlObject,
): CatalogueEditionStatementDto[] {
  return extractEditionStatementsFromText(
    datafields(record, '205').map(toTextField),
  );
}

function resourceTypeFor(value: string | undefined): CatalogueResourceType {
  const normalized = value?.toLowerCase() ?? '';
  if (!normalized) return 'UNSPECIFIED';
  if (/m[uú]sica|partitura/.test(normalized)) return 'NOTATED_MUSIC';
  if (/cartogr|mapa/.test(normalized)) return 'CARTOGRAPHIC';
  if (/som|áudio|audio/.test(normalized)) return 'SOUND';
  if (/manuscrito/.test(normalized)) return 'UNSPECIFIED';
  if (/electr|eletr|cd-rom|dvd/.test(normalized)) return 'ELECTRONIC';
  return 'UNSPECIFIED';
}

function extractSeriesFromText(fields: TextField[]): CatalogueSeriesDto[] {
  return fields
    .filter(({ tag }) => tag === '225')
    .map((field, sortOrder) => ({
      title: field.subfields.get('a')?.[0] ?? '',
      parallelTitle: field.subfields.get('e')?.[0] ?? null,
      issn: field.subfields.get('x')?.[0] ?? null,
      volumeNumber: field.subfields.get('v')?.[0] ?? null,
      sortOrder,
      sourceTag: '225',
    }))
    .filter(({ title }) => Boolean(title));
}

function extractSeriesFromXml(record: XmlObject): CatalogueSeriesDto[] {
  return extractSeriesFromText(datafields(record, '225').map(toTextField));
}

const noteTypes: Record<string, CatalogueNoteDto['type']> = {
  '300': 'GENERAL',
  '317': 'PROVENANCE',
  '320': 'BIBLIOGRAPHY',
  '327': 'CONTENTS',
  '328': 'DISSERTATION',
  '330': 'SUMMARY',
};

function extractNotesFromText(fields: TextField[]): CatalogueNoteDto[] {
  return fields
    .filter(({ tag }) => noteTypes[tag])
    .flatMap((field) =>
      (field.subfields.get('a') ?? []).map((value) => ({
        type: noteTypes[field.tag],
        value,
        sortOrder: 0,
        sourceTag: field.tag,
      })),
    )
    .map((note, sortOrder) => ({ ...note, sortOrder }));
}

function extractNotesFromXml(record: XmlObject): CatalogueNoteDto[] {
  return extractNotesFromText(datafields(record).map(toTextField));
}

const classificationSystems: Record<string, string> = {
  '675': 'UDC',
  '676': 'DDC',
  '680': 'LCC',
  '686': 'OTHER',
};

function extractClassificationsFromText(
  fields: TextField[],
): CatalogueClassificationDto[] {
  return fields
    .filter(({ tag }) => classificationSystems[tag])
    .flatMap((field) =>
      (field.subfields.get('a') ?? []).map((notation) => ({
        notation,
        system: classificationSystems[field.tag],
        systemEdition:
          field.subfields.get('v')?.[0] ??
          field.subfields.get('2')?.[0] ??
          null,
        authorityId: field.subfields.get('3')?.[0] ?? null,
        sortOrder: 0,
        sourceTag: field.tag,
      })),
    )
    .map((classification, sortOrder) => ({ ...classification, sortOrder }));
}

function extractClassificationsFromXml(
  record: XmlObject,
): CatalogueClassificationDto[] {
  return extractClassificationsFromText(datafields(record).map(toTextField));
}

function extractSourceIdentifiersFromText(
  fields: TextField[],
): CatalogueSourceIdentifierDto[] {
  return fields
    .flatMap((field) => {
      if (field.tag === '003') {
        return field.value
          ? [
              {
                type: 'SOURCE_RECORD',
                value: field.value,
                source: 'PORBASE',
                sortOrder: 0,
              },
            ]
          : [];
      }
      if (field.tag === '035') {
        return (field.subfields.get('a') ?? []).map((value, sortOrder) => ({
          type: 'BNP',
          value,
          source: 'PORBASE',
          sortOrder,
        }));
      }
      if (field.tag === '021') {
        return (field.subfields.get('b') ?? []).map((value, sortOrder) => ({
          type: 'NATIONAL_REGISTRATION',
          value,
          source: 'PORBASE',
          sortOrder,
        }));
      }
      return [];
    })
    .map((identifier, sortOrder) => ({ ...identifier, sortOrder }));
}

function extractSourceIdentifiersFromXml(
  record: XmlObject,
): CatalogueSourceIdentifierDto[] {
  return extractSourceIdentifiersFromText(datafields(record).map(toTextField));
}

function toTextField(field: XmlObject): TextField {
  const orderedSubfields = asArray(field.subfield)
    .map((subfield) => ({
      code: textValue(subfield['@_code'])?.toLowerCase() ?? '',
      value: findText(subfield)?.trim() ?? '',
    }))
    .filter(({ code, value }) => Boolean(code && value));
  const subfields = new Map<string, string[]>();
  for (const { code, value } of orderedSubfields) {
    subfields.set(code, [...(subfields.get(code) ?? []), value]);
  }
  return {
    tag: textValue(field['@_tag']) ?? '',
    indicator1: marcIndicator(findText(field['@_ind1'])),
    indicator2: marcIndicator(findText(field['@_ind2'])),
    value: '',
    subfields,
    orderedSubfields,
  };
}

const localFieldTags = new Set(['900', '966', '972', '973', '995', '997']);

const claimedSubfields: Record<string, Set<string> | 'all'> = {
  '001': 'all',
  '003': 'all',
  '010': new Set(['a']),
  '021': new Set(['a', 'b']),
  '035': new Set(['a']),
  '101': new Set(['a', 'c']),
  '102': new Set(['a']),
  '200': new Set(['a', 'b', 'd', 'e', 'f', 'g', 'h', 'i']),
  '205': new Set(['a', 'b', 'f']),
  '210': new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
  '215': new Set(['a', 'c', 'd', 'e']),
  '225': new Set(['a', 'e', 'v', 'x']),
  '300': new Set(['a']),
  '317': new Set(['a']),
  '320': new Set(['a']),
  '327': new Set(['a']),
  '328': new Set(['a']),
  '330': new Set(['a']),
  '500': new Set(['a', 'e']),
  '510': new Set(['a', 'e']),
  '517': new Set(['a', 'e']),
  '518': new Set(['a', 'e']),
  '530': new Set(['a', 'e']),
  '545': new Set(['a', 'e']),
  '560': new Set(['a', 'e']),
  '675': new Set(['a', 'v', 'z', '3']),
  '676': new Set(['a', 'v', 'z', '3']),
  '680': new Set(['a', 'i', 'v', '3']),
  '686': new Set(['a', 'b', '2', '3']),
  '700': 'all',
  '701': 'all',
  '702': 'all',
  '710': 'all',
  '711': 'all',
  '712': 'all',
  '713': 'all',
};

function collectUnmappedTextFields(
  fields: TextField[],
): CatalogueUnmappedFieldDto[] {
  return fields.flatMap((field, occurrence) => {
    const claimed = claimedSubfields[field.tag];
    const subfields = field.orderedSubfields
      .map((part, sortOrder) => ({ ...part, sortOrder }))
      .filter(
        ({ code }) => claimed !== 'all' && (!claimed || !claimed.has(code)),
      );
    if (!subfields.length && field.value && !claimed) {
      subfields.push({ code: '', value: field.value, sortOrder: 0 });
    }
    if (!subfields.length) return [];
    return [
      {
        tag: field.tag,
        indicator1: field.indicator1,
        indicator2: field.indicator2,
        occurrence,
        reason: unmappedReason(field.tag),
        subfields,
      },
    ];
  });
}

function collectUnmappedXmlFields(
  record: XmlObject,
): CatalogueUnmappedFieldDto[] {
  return datafields(record).flatMap((field, occurrence) =>
    collectUnmappedTextFields([toTextField(field)]).map((unmapped) => ({
      ...unmapped,
      occurrence,
    })),
  );
}

function unmappedReason(tag: string): CatalogueUnmappedFieldDto['reason'] {
  if (localFieldTags.has(tag)) return 'LOCAL';
  if (claimedSubfields[tag]) return 'NOT_YET_MODELED';
  return 'UNSUPPORTED';
}

function extractTextPhysicalDescriptions(fields: TextField[]): Array<{
  sortOrder: number;
  source: string;
  parts: Array<{
    subfield: string;
    value: string;
    sortOrder: number;
  }>;
}> {
  const descriptions: Array<{
    sortOrder: number;
    source: string;
    parts: Array<{ subfield: string; value: string; sortOrder: number }>;
  }> = [];
  for (const field of fields.filter(({ tag }) => tag === '215')) {
    const parts = field.orderedSubfields
      .filter(({ value }) => value.trim())
      .map(({ code, value }, sortOrder) => ({
        subfield: code,
        value,
        sortOrder,
      }));
    if (parts.length === 0) continue;
    descriptions.push({
      sortOrder: descriptions.length,
      source: 'PORBASE',
      parts,
    });
  }
  return descriptions;
}

function extractXmlPhysicalDescriptions(record: XmlObject): Array<{
  sortOrder: number;
  source: string;
  parts: Array<{
    subfield: string;
    value: string;
    sortOrder: number;
  }>;
}> {
  const descriptions: Array<{
    sortOrder: number;
    source: string;
    parts: Array<{ subfield: string; value: string; sortOrder: number }>;
  }> = [];
  for (const field of datafields(record, '215')) {
    const parts = asArray(field.subfield)
      .map((subfield) => ({
        code: textValue(subfield['@_code'])?.toLowerCase(),
        value: findText(subfield)?.trim(),
      }))
      .filter((part): part is { code: string; value: string } =>
        Boolean(part.code && /^[a-z0-9]$/.test(part.code) && part.value),
      )
      .map(({ code, value }, sortOrder) => ({
        subfield: code,
        value,
        sortOrder,
      }));
    if (parts.length === 0) continue;
    descriptions.push({
      sortOrder: descriptions.length,
      source: 'PORBASE',
      parts,
    });
  }
  return descriptions;
}

function extractTextPublicationStatements(
  fields: TextField[],
  warnings: CatalogueWarningDto[],
): CataloguePublicationStatementDto[] {
  return fields
    .filter(({ tag }) => tag === '210')
    .map((field, sortOrder) => ({
      sortOrder,
      indicator1: ' ',
      indicator2: '9',
      source: 'PORBASE',
      parts: field.orderedSubfields.map(({ code, value }, partOrder) => ({
        subfield: code,
        value,
        sortOrder: partOrder,
        normalizedValue:
          code === 'd'
            ? normalizePublicationDateForPart(value, warnings)
            : null,
      })),
    }))
    .filter(({ parts }) => parts.length > 0);
}

function extractXmlPublicationStatements(
  record: XmlObject,
  warnings: CatalogueWarningDto[],
): CataloguePublicationStatementDto[] {
  return datafields(record, '210')
    .map((field, sortOrder) => ({
      sortOrder,
      indicator1: marcIndicator(findText(field['@_ind1'])),
      indicator2: marcIndicator(findText(field['@_ind2']), '9'),
      source: 'PORBASE',
      parts: asArray(field.subfield)
        .map((subfield) => ({
          code: textValue(subfield['@_code'])?.toLowerCase() ?? '',
          value: findText(subfield)?.trim() ?? '',
        }))
        .filter(
          ({ code, value }) => /^[a-z0-9]$/.test(code) && value.length > 0,
        )
        .map((subfield, partOrder) => ({
          subfield: subfield.code,
          value: subfield.value,
          sortOrder: partOrder,
          normalizedValue:
            subfield.code === 'd'
              ? normalizePublicationDateForPart(subfield.value, warnings)
              : null,
        })),
    }))
    .filter(({ parts }) => parts.length > 0);
}

function normalizePublicationDateForPart(
  value: string,
  warnings: CatalogueWarningDto[],
): string | null {
  const original = value.trim();
  const match =
    /^(?:D\.?\s*L\.?\s*)?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)[.?]?$|^(?:D\.?\s*L\.?\s*)?(\d{4})[.?]?$/.exec(
      original,
    );
  if (!match) {
    warnings.push({
      code: 'PORBASE_PARSE_ERROR',
      field: 'edition.publicationStatements.210$d',
      message: `Não foi possível extrair data de '${original}'`,
      original,
      type: 'parse_error',
    });
    return null;
  }
  const normalized = [match[1] ?? match[4], match[2], match[3]]
    .filter(Boolean)
    .join('-');
  if (original !== normalized)
    warnings.push({
      code: 'PORBASE_NORMALIZATION',
      field: 'edition.publicationStatements.210$d',
      message: `Data normalizada de '${original}' para '${normalized}'`,
      original,
      normalized,
      type: 'normalization',
    });
  return isValidBibliographicDate(normalized) ? normalized : null;
}

function detectFormat(
  rawContent: string,
  contentType?: string,
): PorbaseDetectedFormat {
  const trimmed = rawContent.trim();
  if (looksLikeXml(trimmed, contentType)) return 'MARCXCHANGE_XML';
  if (looksLikeMarcText(trimmed)) return 'MARC_TEXT';
  return 'UNKNOWN';
}

function looksLikeXml(content: string, contentType?: string): boolean {
  return (
    content.startsWith('<?xml') ||
    content.startsWith('<collection') ||
    content.startsWith('<record') ||
    (contentType?.toLowerCase().includes('xml') === true &&
      content.startsWith('<'))
  );
}

function looksLikeMarcText(content: string): boolean {
  return content
    .split(/\r?\n/)
    .some((line) => /^\s*\d{3}(?:\s+|[:|])/.test(line));
}

function isErrorMessage(content: string): boolean {
  return /^(?:error|erro|registo inexistente|record not found|not found)\b/i.test(
    content,
  );
}

function firstValue(fields: TextField[], tag: string): string | undefined {
  return fields.find((field) => field.tag === tag && field.value)?.value;
}

function firstSubfieldValue(
  fields: TextField[],
  tag: string,
  code: string,
): string | undefined {
  return fields
    .find((field) => field.tag === tag && field.subfields.has(code))
    ?.subfields.get(code)?.[0];
}

function contributorName(field: TextField): string | undefined {
  const given = field.subfields.get('b')?.[0];
  const family = field.subfields.get('a')?.[0];
  return [family, given].filter(Boolean).join(', ') || undefined;
}

function roleLabel(tag: string, codes: string[]): string | undefined {
  if (tag === '700' || tag === '701') return 'author';
  return codes.includes('730') ? 'translator' : undefined;
}

function contributionDisplayName(
  parts: Array<{ code: string; value: string }>,
): string | undefined {
  const family = parts.find(({ code }) => code === 'a')?.value;
  const given = parts.find(({ code }) => code === 'b')?.value;
  return family ? (given ? `${family}, ${given}` : family) : undefined;
}

function marcIndicator(
  value: string | null | undefined,
  fallback = ' ',
): string {
  return value == null || value === '' ? fallback : value;
}

function extractTextContributions(
  fields: TextField[],
): NonNullable<PorbaseBibliographicFieldsDto['contributions']> {
  return fields
    .filter(({ tag }) =>
      ['700', '701', '702', '710', '711', '712', '713'].includes(tag),
    )
    .flatMap((field) => {
      const sourceParts = field.orderedSubfields
        .filter(
          ({ code, value }) =>
            /^[a-z0-9]$/i.test(code) && Boolean(value.trim()),
        )
        .map(({ code, value }, sortOrder) => ({
          code: code.toLowerCase(),
          value,
          sortOrder,
        }));
      const displayName = contributionDisplayName(sourceParts);
      if (!displayName) return [];
      const codes = sourceParts
        .filter(({ code }) => code === '4')
        .map(({ value }) => value);
      return [
        {
          targetScope: 'WORK' as const,
          kind: ['710', '711', '712', '713'].includes(field.tag)
            ? ('CORPORATE_BODY' as const)
            : ('PERSON' as const),
          displayName,
          roleLabel: roleLabel(field.tag, codes),
          relationshipCodeScheme: sourceParts.find(({ code }) => code === '2')
            ?.value,
          sourceTag: field.tag as
            '700' | '701' | '702' | '710' | '711' | '712' | '713',
          authorityId: sourceParts.find(({ code }) => code === '3')?.value,
          indicator1: ' ',
          indicator2: ' ',
          sourceParts,
          sortOrder: 0,
        },
      ];
    })
    .map((contribution, sortOrder) => ({ ...contribution, sortOrder }));
}

function extractXmlContributions(
  record: XmlObject,
): NonNullable<PorbaseBibliographicFieldsDto['contributions']> {
  return ['700', '701', '702', '710', '711', '712', '713']
    .flatMap((tag) =>
      datafields(record, tag).map((field) => {
        const sourceParts = asArray(field.subfield)
          .map((subfield) => ({
            code: textValue(subfield['@_code'])?.toLowerCase() ?? '',
            value: findText(subfield)?.trim() ?? '',
          }))
          .filter(
            ({ code, value }) => /^[a-z0-9]$/.test(code) && Boolean(value),
          )
          .map((part, sortOrder) => ({ ...part, sortOrder }));
        const displayName = contributionDisplayName(sourceParts);
        if (!displayName || !sourceParts.length) return undefined;
        const codes = sourceParts
          .filter(({ code }) => code === '4')
          .map(({ value }) => value);
        return {
          targetScope: 'WORK' as const,
          kind: ['710', '711', '712', '713'].includes(tag)
            ? ('CORPORATE_BODY' as const)
            : ('PERSON' as const),
          displayName,
          roleLabel: roleLabel(tag, codes),
          relationshipCodeScheme: sourceParts.find(({ code }) => code === '2')
            ?.value,
          sourceTag: tag as
            '700' | '701' | '702' | '710' | '711' | '712' | '713',
          authorityId: sourceParts.find(({ code }) => code === '3')?.value,
          indicator1: marcIndicator(findText(field['@_ind1'])),
          indicator2: marcIndicator(findText(field['@_ind2'])),
          sourceParts,
          sortOrder: 0,
        };
      }),
    )
    .filter((contribution): contribution is NonNullable<typeof contribution> =>
      Boolean(contribution),
    )
    .map((contribution, sortOrder) => ({ ...contribution, sortOrder }));
}

function extractTranslatorName(value: string): string | undefined {
  const match = /(?:trad\.?|translator)\s*[:.]?\s*(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || undefined;
}

type XmlObject = Record<string, unknown>;

function asArray(value: unknown): XmlObject[] {
  if (Array.isArray(value)) return value.filter(isXmlObject);
  return isXmlObject(value) ? [value] : [];
}

function isXmlObject(value: unknown): value is XmlObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findFirstObject(value: unknown, key: string): XmlObject | undefined {
  if (isXmlObject(value)) {
    const direct = value[key];
    if (isXmlObject(direct)) return direct;
    if (Array.isArray(direct)) return direct.find(isXmlObject);
    for (const child of Object.values(value)) {
      const result = findFirstObject(child, key);
      if (result) return result;
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const result = findFirstObject(child, key);
      if (result) return result;
    }
  }
  return undefined;
}

function findFirstValue(value: unknown, key: string): unknown {
  if (isXmlObject(value)) {
    if (key in value) return value[key];
    for (const child of Object.values(value)) {
      const result = findFirstValue(child, key);
      if (result !== undefined) return result;
    }
  } else if (Array.isArray(value)) {
    for (const child of value) {
      const result = findFirstValue(child, key);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

function findText(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  if (isXmlObject(value)) return findText(value['#text']);
  return undefined;
}

function textValue(value: unknown): string | undefined {
  return findText(value)?.trim();
}

function datafields(record: XmlObject, tag?: string): XmlObject[] {
  const fields = asArray(record.datafield);
  return tag === undefined
    ? fields
    : fields.filter((field) => textValue(field['@_tag']) === tag);
}

function controlfieldValues(record: XmlObject, tag: string): string[] {
  return asArray(record.controlfield)
    .filter((field) => textValue(field['@_tag']) === tag)
    .map((field) => findText(field)?.trim())
    .filter((value): value is string => Boolean(value));
}

function firstControlfield(record: XmlObject, tag: string): string | undefined {
  return controlfieldValues(record, tag)[0];
}

function subfieldValues(field: XmlObject, code: string): string[] {
  return asArray(field.subfield)
    .filter((subfield) => textValue(subfield['@_code']) === code)
    .map((subfield) => findText(subfield)?.trim())
    .filter((value): value is string => Boolean(value));
}

function firstSubfield(
  record: XmlObject,
  tag: string,
  code: string,
): string | undefined {
  return datafields(record, tag).flatMap((field) =>
    subfieldValues(field, code),
  )[0];
}

function contributorNameFromXml(field: XmlObject): string | undefined {
  const family = subfieldValues(field, 'a')[0];
  const given = subfieldValues(field, 'b')[0];
  return [family, given].filter(Boolean).join(', ') || undefined;
}
