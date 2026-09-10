import { Injectable, NotFoundException } from '@nestjs/common';
import type { CatalogueProvider } from './catalogue-provider.js';
import { PorbaseCatalogueProvider } from './porbase/porbase.provider.js';

@Injectable()
export class CatalogueService {
  private readonly providers = new Map<string, CatalogueProvider>();

  constructor(porbaseProvider: PorbaseCatalogueProvider) {
    this.register(porbaseProvider);
  }

  register(provider: CatalogueProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): CatalogueProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new NotFoundException(`Catalogue provider ${id} not found`);
    }
    return provider;
  }

  getDefaultProvider(): CatalogueProvider {
    return this.getProvider('porbase');
  }

  listProviders(): CatalogueProvider[] {
    return [...this.providers.values()];
  }
}
