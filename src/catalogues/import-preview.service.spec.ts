import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportPreviewService } from './import-preview.service.js';
import { CataloguesService } from './catalogues.service.js';
import { parsePorbaseResponse } from './porbase.parser.js';
import { PorbaseImportDto } from './dto/porbase-import.dto.js';
import type { PorbaseSearchResponseDto } from './dto/porbase-search-response.dto.js';

const isbn = '9789724426495';
const fixture = readFileSync(
  new URL('./fixtures/porbase-9789724426495.txt', import.meta.url),
  'utf8',
);

describe('ImportPreviewService', () => {
  let cataloguesService: { searchPorbaseByIsbn: ReturnType<typeof vi.fn> };
  let service: ImportPreviewService;

  beforeEach(() => {
    cataloguesService = { searchPorbaseByIsbn: vi.fn() };
    service = new ImportPreviewService(
      cataloguesService as unknown as CataloguesService,
    );
  });

  it('rejects an invalid ISBN before producing a preview', async () => {
    await expect(service.createPreview('9789724426496')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(cataloguesService.searchPorbaseByIsbn).not.toHaveBeenCalled();
  });

  it('returns not found when PORBASE has no record', async () => {
    cataloguesService.searchPorbaseByIsbn.mockResolvedValue({
      source: 'PORBASE',
      query: isbn,
      found: false,
      detectedFormat: 'ERROR',
      format: 'Unknown',
      schema: 'UNIMARC',
      rawContent:
        '<urn-response><error>Registo inexistente</error></urn-response>',
      metadata: {
        authors: [],
        translators: [],
        shelfmarks: [],
        identifiers: [],
      },
      fields: { authors: [], translators: [], shelfmarks: [], identifiers: [] },
      warnings: [
        { message: 'No PORBASE record was found.', type: 'provider_error' },
      ],
    } satisfies PorbaseSearchResponseDto);

    await expect(service.createPreview(isbn)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('builds an import preview from the real PORBASE fixture', async () => {
    const searchResult = parsePorbaseResponse(
      isbn,
      fixture,
      'text/xml;charset=utf-8',
    );
    cataloguesService.searchPorbaseByIsbn.mockResolvedValue(searchResult);

    const result = await service.createPreview(isbn);

    expect(result).toMatchObject({
      work: { title: 'Vida e andanças de Alexis Zorbás' },
      edition: {
        title: 'Vida e andanças de Alexis Zorbás',
        isbn13: isbn,
        publisher: 'Edições 70',
        publicationDate: '2022',
        language: 'por',
        placeOfPublication: 'Coimbra',
        pageCount: 383,
        physicalDescriptions: [
          { sortOrder: 0, source: 'PORBASE', parts: [
            { subfield: 'a', value: '383 p.', sortOrder: 0 },
            { subfield: 'd', value: '24 cm', sortOrder: 1 },
          ] },
        ],
      },
      contributors: [
        { name: 'Kazantzákis, Níkos', role: 'author' },
        { name: 'Leite, Carlos', role: 'translator' },
      ],
      externalIdentifiers: [
        { type: 'ISBN-13', value: isbn, source: 'PORBASE' },
        { type: 'PORBASE', value: '3664836', source: 'PORBASE' },
      ],
      bibliographicRecord: {
        format: 'MARCXCHANGE',
        schema: 'UNIMARC',
        source: 'PORBASE',
        remoteId: '3664836',
        rawContent: fixture,
      },
    });
    expect(result.warnings).toEqual([]);
  });

  it('retains complex physical text and warns only when pages cannot be derived', async () => {
    cataloguesService.searchPorbaseByIsbn.mockResolvedValue({
      source: 'PORBASE',
      query: isbn,
      found: true,
      detectedFormat: 'MARCXCHANGE_XML',
      format: 'Unimarc',
      schema: 'UNIMARC',
      rawContent: '<collection />',
      metadata: {
        title: 'Título',
        authors: [],
        extent: '146, [6] p.',
          physicalDescriptions: [{
            sortOrder: 0,
            source: 'PORBASE',
            parts: [{ subfield: 'a', value: '146, [6] p.', sortOrder: 0 }],
          }],
      },
      fields: {},
      warnings: [],
    } as unknown as PorbaseSearchResponseDto);

    const result = await service.createPreview(isbn);

    expect(result.edition.pageCount).toBeNull();
    expect(result.edition.physicalDescriptions).toEqual([
      { sortOrder: 0, source: 'PORBASE', parts: [{ subfield: 'a', value: '146, [6] p.', sortOrder: 0 }] },
    ]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        field: 'edition.physicalDescriptions',
        type: 'parse_error',
      }),
    );
  });

  it('carries parser warnings into the stable preview response', async () => {
    cataloguesService.searchPorbaseByIsbn.mockResolvedValue({
      source: 'PORBASE',
      query: isbn,
      found: true,
      detectedFormat: 'MARC_TEXT',
      format: 'MARC',
      schema: 'UNIMARC',
      rawContent: '001 3664836',
      metadata: { authors: [], warnings: undefined },
      fields: { authors: [] },
      warnings: [
        {
          field: 'work.title',
          message: 'No unambiguous title field was found in the MARC text.',
          type: 'missing_field',
        },
      ],
    } as unknown as PorbaseSearchResponseDto);

    const result = await service.createPreview(isbn);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        message: 'No unambiguous title field was found in the MARC text.',
      }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        message: 'The import title was not identified safely.',
      }),
    );
  });
  it('produces publication and contribution indicators valid for unchanged confirmation', async () => {
    const rawContent = '<collection><record><datafield tag="210"><subfield code="a">Lisboa</subfield></datafield><datafield tag="700" ind2="1"><subfield code="a">Doe</subfield><subfield code="b">Jane</subfield></datafield><datafield tag="702"><subfield code="a">Roe</subfield><subfield code="b">Richard</subfield><subfield code="4">273</subfield></datafield><datafield tag="702"><subfield code="a">Smith</subfield><subfield code="b">Sam</subfield><subfield code="4">560</subfield></datafield></record></collection>';
    const parsed = parsePorbaseResponse(isbn, rawContent, 'text/xml');
    cataloguesService.searchPorbaseByIsbn.mockResolvedValue(parsed);

    const preview = await service.createPreview(isbn);
    const confirmation = plainToInstance(PorbaseImportDto, {
      work: preview.work,
      edition: { ...preview.edition, publicationPlace: preview.edition.placeOfPublication },
      contributors: preview.contributors.map((contributor) => ({ ...contributor, scope: 'WORK' })),
      contributions: preview.contributions,
      externalIdentifiers: preview.externalIdentifiers,
      bibliographicRecord: preview.bibliographicRecord,
      item: { status: 'OWNED' },
    });
    const errors = await validate(confirmation);

    expect(errors).toEqual([]);
    expect(preview.edition.publicationStatements?.[0].indicator1).toBe(' ');
    expect(preview.contributions.map(({ sourceTag, indicator1, indicator2 }) => [sourceTag, indicator1, indicator2])).toEqual([
      ['700', ' ', '1'],
      ['702', ' ', ' '],
      ['702', ' ', ' '],
    ]);
  });
});
