import { XMLParser } from 'fast-xml-parser';
import {
  PorbaseBibliographicFieldsDto,
  PorbaseDetectedFormat,
  PorbaseSearchResponseDto,
  PorbaseWarningDto,
  PorbaseWarningType,
} from './dto/porbase-search-response.dto.js';
import { PorbaseXmlError } from './catalogues.types.js';

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
      warnings: [warning('PORBASE returned an empty response.', 'provider_error')],
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
    warnings: [warning('No PORBASE record was found.', 'provider_error')],
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

  const warnings: PorbaseWarningDto[] = [];
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
  const warnings: PorbaseWarningDto[] = [];
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
  value: string;
  subfields: Map<string, string[]>;
}

function parseMarcTextFields(
  rawContent: string,
  warnings: PorbaseWarningDto[],
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
    const subfieldMatches = [...remainder.matchAll(/\$([a-z0-9])\s*([^$]*)/gi)];
    for (const subfield of subfieldMatches) {
      const [, code, value] = subfield;
      const values = subfields.get(code.toLowerCase()) ?? [];
      values.push(value.trim());
      subfields.set(code.toLowerCase(), values);
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
    fields.push({ tag, value, subfields });
  }
  return fields;
}

function extractTextMetadata(
  fields: TextField[],
  warnings: PorbaseWarningDto[],
): PorbaseBibliographicFieldsDto {
  const metadata: PorbaseBibliographicFieldsDto = {
    authors: [],
    translators: [],
    shelfmarks: [],
    identifiers: [],
  };

  metadata.recordId = firstValue(fields, '001');
  metadata.isbn = firstSubfieldValue(fields, '010', 'a');
  metadata.language = firstSubfieldValue(fields, '101', 'a');
  metadata.title = firstSubfieldValue(fields, '200', 'a');
  metadata.placeOfPublication = firstSubfieldValue(fields, '210', 'a');
  metadata.publisher = firstSubfieldValue(fields, '210', 'c');
  metadata.publicationDate = normalizePublicationDate(
    firstSubfieldValue(fields, '210', 'd'),
    warnings,
  );
  metadata.extent = firstSubfieldValue(fields, '215', 'a');

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

  metadata.shelfmarks = fields
    .filter((field) => field.tag === '966')
    .flatMap((field) => field.subfields.get('s') ?? [])
    .filter(Boolean);
  metadata.identifiers = fields
    .filter((field) => ['003', '035', '675'].includes(field.tag))
    .flatMap((field) => [field.value, ...(field.subfields.get('a') ?? [])])
    .filter(Boolean);

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
  warnings: PorbaseWarningDto[],
): PorbaseBibliographicFieldsDto {
  const metadata: PorbaseBibliographicFieldsDto = {
    authors: [],
    translators: [],
    shelfmarks: [],
    identifiers: [],
  };

  metadata.recordId = firstControlfield(record, '001');
  metadata.isbn = firstSubfield(record, '010', 'a');
  metadata.language = firstSubfield(record, '101', 'a');
  metadata.title = firstSubfield(record, '200', 'a');
  metadata.placeOfPublication = firstSubfield(record, '210', 'a');
  metadata.publisher = firstSubfield(record, '210', 'c');
  metadata.publicationDate = normalizePublicationDate(
    firstSubfield(record, '210', 'd'),
    warnings,
  );
  metadata.extent = firstSubfield(record, '215', 'a');

  metadata.authors = ['700', '701']
    .flatMap((tag) => datafields(record, tag).map(contributorNameFromXml))
    .filter((value): value is string => Boolean(value));
  metadata.translators = datafields(record, '702')
    .filter((field) => subfieldValues(field, '4').includes('730'))
    .map(contributorNameFromXml)
    .filter((value): value is string => Boolean(value));

  const statementTranslator = firstSubfield(record, '200', 'g');
  if (metadata.translators.length === 0 && statementTranslator) {
    const translator = extractTranslatorName(statementTranslator);
    if (translator) metadata.translators = [translator];
  }

  metadata.shelfmarks = datafields(record, '966').flatMap((field) =>
    subfieldValues(field, 's'),
  );
  metadata.identifiers = [
    ...controlfieldValues(record, '003'),
    ...datafields(record, '035').flatMap((field) => subfieldValues(field, 'a')),
    ...datafields(record, '675').flatMap((field) => subfieldValues(field, '3')),
  ];

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
    warnings: PorbaseWarningDto[];
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
  warnings: PorbaseWarningDto[],
): string | null | undefined {
  if (!value) return undefined;

  const original = value.trim();
  const match = /^(?:D\.?\s*L\.?\s*)?(\d{4})[.?]?$/.exec(original);
  if (!match) {
    warnings.push({
      field: 'edition.publishDate',
      message: `Não foi possível extrair data de '${original}'`,
      original,
      type: 'parse_error',
    });
    return null;
  }

  const normalized = match[1];
  if (original !== normalized) {
    warnings.push({
      field: 'edition.publishDate',
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
  type: PorbaseWarningType,
  field?: string,
): PorbaseWarningDto {
  return { field, message, type };
}

function emptyMetadata(): PorbaseBibliographicFieldsDto {
  return { authors: [], translators: [], shelfmarks: [], identifiers: [] };
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

function datafields(record: XmlObject, tag: string): XmlObject[] {
  return asArray(record.datafield).filter(
    (field) => textValue(field['@_tag']) === tag,
  );
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
