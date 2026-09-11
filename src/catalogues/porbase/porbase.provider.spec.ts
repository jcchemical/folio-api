import { describe, expect, it, vi } from 'vitest';
import { ImportPreviewService } from '../import-preview.service.js';
import { PorbaseImportService } from '../porbase-import.service.js';
import { PorbaseCatalogueProvider } from './porbase.provider.js';

describe('PorbaseCatalogueProvider', () => {
  it('delegates preview and confirmed imports to existing PORBASE services', async () => {
    const previews = {
      createPreview: vi.fn().mockResolvedValue({ preview: true }),
    };
    const imports = { import: vi.fn().mockResolvedValue({ id: 'work-1' }) };
    const provider = new PorbaseCatalogueProvider(
      previews as unknown as ImportPreviewService,
      imports as unknown as PorbaseImportService,
    );
    const input = {} as never;

    await expect(
      provider.searchPreview({ type: 'isbn', isbn: '9789724426495' }),
    ).resolves.toEqual({ preview: true, sourceId: 'porbase' });
    await expect(provider.import('user-1', input)).resolves.toEqual({
      id: 'work-1',
      sourceId: 'porbase',
    });

    expect(previews.createPreview).toHaveBeenCalledWith('9789724426495');
    expect(imports.import).toHaveBeenCalledWith('user-1', input, 'porbase');
  });

  it('supports only ISBN searches and UNIMARC', async () => {
    const provider = new PorbaseCatalogueProvider(
      {} as ImportPreviewService,
      {} as PorbaseImportService,
    );

    expect(provider.supportsSearchType('isbn')).toBe(true);
    expect(provider.supportsSearchType('title')).toBe(false);
    expect(provider.supportsSearchType('author')).toBe(false);
    expect(provider.supportsSearchType('keyword')).toBe(false);
    expect(provider.supportsFormat('UNIMARC')).toBe(true);
    expect(provider.supportsFormat('MARC21')).toBe(false);
    await expect(
      provider.searchPreview({ type: 'title', title: 'Zorbás' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'CATALOGUE_SEARCH_TYPE_UNSUPPORTED' },
    });
    await expect(
      provider.searchPreview({ type: 'author', author: 'Kazantzakis' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'CATALOGUE_SEARCH_TYPE_UNSUPPORTED' },
    });
    await expect(
      provider.searchPreview({ type: 'keyword', keyword: 'grega' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'CATALOGUE_SEARCH_TYPE_UNSUPPORTED' },
    });
  });
});
