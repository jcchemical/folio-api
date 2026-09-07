import { BadRequestException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportPreviewService } from './import-preview.service.js';
import { CataloguesService } from './catalogues.service.js';
import { parsePorbaseResponse } from './porbase.parser.js';
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
        publishDate: '2022',
        language: 'por',
        placeOfPublication: 'Coimbra',
        pages: 383,
        physicalDescriptions: [
          { subfield: 'a', value: '383 p.', sortOrder: 0, source: 'PORBASE' },
          { subfield: 'd', value: '24 cm', sortOrder: 1, source: 'PORBASE' },
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
        physicalDescriptions: [
          { subfield: 'a', value: '146, [6] p.', sortOrder: 0, source: 'PORBASE' },
        ],
      },
      fields: {},
      warnings: [],
    } as unknown as PorbaseSearchResponseDto);

    const result = await service.createPreview(isbn);

    expect(result.edition.pages).toBeNull();
    expect(result.edition.physicalDescriptions).toEqual([
      { subfield: 'a', value: '146, [6] p.', sortOrder: 0, source: 'PORBASE' },
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
});
