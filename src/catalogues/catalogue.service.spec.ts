import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CatalogueProvider } from './catalogue-provider.js';
import { CatalogueService } from './catalogue.service.js';
import { PorbaseCatalogueProvider } from './porbase/porbase.provider.js';

const porbaseProvider: CatalogueProvider = {
  id: 'porbase',
  name: 'PORBASE',
  format: 'UNIMARC',
  searchPreview: async () => ({}) as never,
  import: async () => ({}) as never,
  supportsSearchType: (type) => type === 'isbn',
  supportsFormat: (format) => format === 'UNIMARC',
};

describe('CatalogueService', () => {
  it('registers PORBASE as the default provider', () => {
    const service = new CatalogueService(
      porbaseProvider as PorbaseCatalogueProvider,
    );

    expect(service.getDefaultProvider()).toBe(porbaseProvider);
    expect(service.listProviders()).toEqual([porbaseProvider]);
  });

  it('registers and resolves additional providers by id', () => {
    const service = new CatalogueService(
      porbaseProvider as PorbaseCatalogueProvider,
    );
    const additionalProvider = { ...porbaseProvider, id: 'test' };

    service.register(additionalProvider);

    expect(service.getProvider('test')).toBe(additionalProvider);
  });

  it('rejects unknown provider ids', () => {
    const service = new CatalogueService(
      porbaseProvider as PorbaseCatalogueProvider,
    );

    expect(() => service.getProvider('missing')).toThrow(NotFoundException);
  });
});
