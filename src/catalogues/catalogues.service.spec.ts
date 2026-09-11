import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PorbaseAdapter } from './adapters/porbase.adapter.js';
import { CataloguesService } from './catalogues.service.js';
import { PorbaseUpstreamError } from './catalogues.types.js';

const validIsbn = '9789724426495';
const marcxchange = readFileSync(
  new URL('./fixtures/porbase-9789724426495.txt', import.meta.url),
  'utf8',
);
const marcText = [
  '001 3664836',
  '010 $a 978-972-44-2649-5',
  '101 $a por',
  '200 $a Vida e andanças de Alexis Zorbás $f Nikos Kazantzakis $g trad. Carlos Leite',
  '210 $a Coimbra $c Edições 70 $d 2022',
  '215 $a 383 p.',
  '700 $a Kazantzákis $b Níkos',
  '702 $a Leite $b Carlos $4 730',
  '966 $s 4-(1)-40-5-39',
].join('\n');

describe('CataloguesService', () => {
  let adapter: { searchByIsbn: ReturnType<typeof vi.fn> };
  let service: CataloguesService;

  beforeEach(() => {
    adapter = { searchByIsbn: vi.fn() };
    service = new CataloguesService(adapter as unknown as PorbaseAdapter);
  });

  it('normalizes the ISBN before calling PORBASE and extracts MARC fields', async () => {
    adapter.searchByIsbn.mockResolvedValue({
      status: 200,
      body: marcxchange,
      contentType: 'text/xml;charset=utf-8',
    });

    const result = await service.searchPorbase('978-972 4426495');

    expect(adapter.searchByIsbn).toHaveBeenCalledWith(validIsbn);
    expect(result).toMatchObject({
      source: 'PORBASE',
      query: validIsbn,
      found: true,
      detectedFormat: 'MARCXCHANGE_XML',
      schema: 'UNIMARC',
      metadata: {
        title: 'Vida e andanças de Alexis Zorbás',
        authors: ['Kazantzákis, Níkos'],
        isbn: '978-972-44-2649-5',
        publisher: 'Edições 70',
        publicationDate: '2022',
        recordId: '3664836',
      },
    });
    expect(result.rawContent).toBe(marcxchange);
  });

  it('extracts conservative metadata from line-oriented MARC text', async () => {
    adapter.searchByIsbn.mockResolvedValue({
      status: 200,
      body: marcText,
      contentType: 'text/plain',
    });

    const result = await service.searchPorbase(validIsbn);

    expect(result).toMatchObject({
      found: true,
      detectedFormat: 'MARC_TEXT',
      metadata: {
        recordId: '3664836',
        isbn: '978-972-44-2649-5',
        title: 'Vida e andanças de Alexis Zorbás',
        authors: ['Kazantzákis, Níkos'],
        translators: ['Leite, Carlos'],
        language: 'por',
        placeOfPublication: 'Coimbra',
        publisher: 'Edições 70',
        publicationDate: '2022',
        extent: '383 p.',
        physicalDescriptions: [
          {
            sortOrder: 0,
            source: 'PORBASE',
            parts: [{ subfield: 'a', value: '383 p.', sortOrder: 0 }],
          },
        ],
        unmappedFields: [
          expect.objectContaining({
            tag: '966',
            reason: 'LOCAL',
            subfields: [
              expect.objectContaining({ code: 's', value: '4-(1)-40-5-39' }),
            ],
          }),
        ],
      },
      warnings: [],
    });
    expect(result.rawContent).toBe(marcText);
  });

  it('rejects invalid ISBNs without making an external request', async () => {
    await expect(service.searchPorbase('9789724426496')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(adapter.searchByIsbn).not.toHaveBeenCalled();
  });

  it('returns found false for HTTP 404 and empty responses', async () => {
    adapter.searchByIsbn.mockResolvedValueOnce({
      status: 404,
      body: 'not found',
      contentType: 'text/plain',
    });
    await expect(service.searchPorbase(validIsbn)).resolves.toMatchObject({
      found: false,
      query: validIsbn,
      detectedFormat: 'ERROR',
    });

    adapter.searchByIsbn.mockResolvedValueOnce({
      status: 200,
      body: '  ',
      contentType: 'text/plain',
    });
    await expect(service.searchPorbase(validIsbn)).resolves.toMatchObject({
      found: false,
    });
  });

  it('treats PORBASE error XML as a missing record', async () => {
    adapter.searchByIsbn.mockResolvedValue({
      status: 200,
      body: '<urn-response><error>Registo inexistente</error></urn-response>',
      contentType: 'text/xml',
    });

    await expect(service.searchPorbase(validIsbn)).resolves.toMatchObject({
      found: false,
    });
  });

  it('maps timeout and upstream server errors', async () => {
    adapter.searchByIsbn.mockRejectedValueOnce(
      new PorbaseUpstreamError('timeout', 'timeout'),
    );
    await expect(service.searchPorbase(validIsbn)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    adapter.searchByIsbn.mockRejectedValueOnce(
      new PorbaseUpstreamError('server-error', 'server error'),
    );
    await expect(service.searchPorbase(validIsbn)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps invalid XML and HTTP 5xx responses to a bad gateway', async () => {
    adapter.searchByIsbn.mockResolvedValueOnce({
      status: 200,
      body: '<collection><record>',
      contentType: 'text/xml',
    });
    await expect(service.searchPorbase(validIsbn)).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    adapter.searchByIsbn.mockResolvedValueOnce({
      status: 503,
      body: '',
      contentType: 'text/plain',
    });
    await expect(service.searchPorbase(validIsbn)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('returns unknown for content that is neither XML nor MARC text', async () => {
    adapter.searchByIsbn.mockResolvedValue({
      status: 200,
      body: 'PORBASE response format not documented',
      contentType: 'text/plain',
    });

    await expect(service.searchPorbase(validIsbn)).resolves.toMatchObject({
      found: false,
      detectedFormat: 'UNKNOWN',
      rawContent: 'PORBASE response format not documented',
    });
  });
});
