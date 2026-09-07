import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidIsbn, normalizeIsbn } from './isbn.utils.js';
import { CataloguesService } from './catalogues.service.js';
import type {
  PorbaseBibliographicFieldsDto,
  PorbaseWarningDto,
} from './dto/porbase-search-response.dto.js';
import type {
  ImportPreviewContributorDto,
  ImportPreviewEditionDto,
  ImportPreviewExternalIdentifierDto,
  ImportPreviewResponseDto,
} from './dto/import-preview-response.dto.js';

@Injectable()
export class ImportPreviewService {
  constructor(private readonly cataloguesService: CataloguesService) {}

  async createPreview(isbn: string): Promise<ImportPreviewResponseDto> {
    const normalizedIsbn = normalizeIsbn(isbn);
    if (!isValidIsbn(normalizedIsbn)) {
      throw new BadRequestException('Invalid ISBN-10 or ISBN-13');
    }

    const result =
      await this.cataloguesService.searchPorbaseByIsbn(normalizedIsbn);

    if (!result.found) {
      throw new NotFoundException('No PORBASE record found for this ISBN');
    }

    return this.mapResult(result.query, result.metadata, result);
  }

  private mapResult(
    query: string,
    metadata: PorbaseBibliographicFieldsDto,
    result: {
      detectedFormat: string;
      schema: string;
      rawContent: string;
      warnings: PorbaseWarningDto[];
    },
  ): ImportPreviewResponseDto {
    const title = metadata.title ?? `Import preview for ${query}`;
    const normalizedIsbn = normalizeIsbn(metadata.isbn ?? query);
    const edition: ImportPreviewEditionDto = {
      title,
      publisher: metadata.publisher,
      publishDate: metadata.publicationDate,
      language: metadata.language,
      placeOfPublication: metadata.placeOfPublication,
      pages: parsePages(metadata.physicalDescriptions, metadata.extent),
      physicalDescriptions: metadata.physicalDescriptions ?? [],
    };

    if (/^\d{13}$/.test(normalizedIsbn)) edition.isbn13 = normalizedIsbn;
    if (/^\d{9}[\dX]$/.test(normalizedIsbn)) edition.isbn10 = normalizedIsbn;

    const contributors = [
      ...toContributors(metadata.authors, 'author'),
      ...toContributors(metadata.translators ?? [], 'translator'),
    ];
    const externalIdentifiers = toExternalIdentifiers(metadata, query);
    const warnings = [...result.warnings];

    if (!metadata.title)
      warnings.push(warning('The import title was not identified safely.', 'missing_field', 'work.title'));
    if (!metadata.publisher)
      warnings.push(warning('Publisher was not identified.', 'missing_field', 'edition.publisher'));
    if (!metadata.publicationDate && !hasWarningForField(warnings, 'edition.publishDate'))
      warnings.push(warning('Publication date was not identified.', 'missing_field', 'edition.publishDate'));
    if (!metadata.language)
      warnings.push(warning('Language was not identified.', 'missing_field', 'edition.language'));
    if (metadata.extent && edition.pages == null) {
      warnings.push(warning('The physical description was preserved, but no reliable numeric page count could be derived.', 'parse_error', 'edition.physicalDescriptions'));
    }
    if (
      result.detectedFormat !== 'MARCXCHANGE_XML' &&
      result.detectedFormat !== 'MARC_TEXT'
    ) {
      warnings.push(warning('The detected response format is not a supported bibliographic format.', 'parse_error'));
    }

    return {
      work: { title },
      edition,
      contributors,
      externalIdentifiers,
      bibliographicRecord: {
        format:
          result.detectedFormat === 'MARC_TEXT' ? 'MARC_TEXT' : 'MARCXCHANGE',
        schema: 'UNIMARC',
        source: 'PORBASE',
        remoteId: metadata.recordId,
        rawContent: result.rawContent,
      },
      warnings: unique(warnings),
    };
  }
}

function toContributors(
  names: string[],
  role: string,
): ImportPreviewContributorDto[] {
  return names.filter(Boolean).map((name) => ({ name, role }));
}

function toExternalIdentifiers(
  metadata: PorbaseBibliographicFieldsDto,
  query: string,
): ImportPreviewExternalIdentifierDto[] {
  const identifiers: ImportPreviewExternalIdentifierDto[] = [];
  const isbn = normalizeIsbn(metadata.isbn ?? query);

  if (/^\d{13}$/.test(isbn)) {
    identifiers.push({ type: 'ISBN-13', value: isbn, source: 'PORBASE' });
  } else if (/^\d{9}[\dX]$/.test(isbn)) {
    identifiers.push({ type: 'ISBN-10', value: isbn, source: 'PORBASE' });
  }

  if (metadata.recordId) {
    identifiers.push({
      type: 'PORBASE',
      value: metadata.recordId,
      source: 'PORBASE',
    });
  }

  return identifiers;
}

function parsePages(
  descriptions?: Array<{ subfield: string; value: string }>,
  extent?: string,
): number | null {
  const pageValues = (descriptions ?? [])
    .filter(({ subfield }) => subfield === 'a')
    .map(({ value }) => value.trim());
  const candidates = (pageValues.length ? pageValues : extent ? [extent] : [])
    .map((value) => /^(\d+)\s*(?:p\.?|pages?)$/i.exec(value)?.[1])
    .filter((value): value is string => Boolean(value));
  return candidates.length === 1 ? Number(candidates[0]) : null;
}

function hasWarningForField(warnings: PorbaseWarningDto[], field: string): boolean {
  return warnings.some((warning) => warning.field === field);
}

function warning(
  message: string,
  type: PorbaseWarningDto['type'],
  field?: string,
): PorbaseWarningDto {
  return { field, message, type };
}

function unique(values: PorbaseWarningDto[]): PorbaseWarningDto[] {
  return values.filter(
    (value, index) =>
      values.findIndex(
        (other) => JSON.stringify(other) === JSON.stringify(value),
      ) === index,
  );
}
