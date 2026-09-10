import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CataloguePreview,
  CatalogueProvider,
  CatalogueSearchQuery,
  ImportedCatalogueRecord,
  MarcFormat,
  SearchType,
} from '../catalogue-provider.js';
import type { PorbaseImportDto } from '../dto/porbase-import.dto.js';
import { ImportPreviewService } from '../import-preview.service.js';
import { PorbaseImportService } from '../porbase-import.service.js';

@Injectable()
export class PorbaseCatalogueProvider implements CatalogueProvider {
  readonly id = 'porbase';
  readonly name = 'PORBASE';
  readonly format = 'UNIMARC' as const;

  constructor(
    private readonly importPreviewService: ImportPreviewService,
    private readonly porbaseImportService: PorbaseImportService,
  ) {}

  async searchPreview(query: CatalogueSearchQuery): Promise<CataloguePreview> {
    if (!query.isbn) {
      throw new BadRequestException('An ISBN is required for PORBASE searches');
    }
    return this.importPreviewService.createPreview(query.isbn);
  }

  import(
    userId: string,
    input: PorbaseImportDto,
  ): Promise<ImportedCatalogueRecord> {
    return this.porbaseImportService.import(userId, input);
  }

  supportsSearchType(type: SearchType): boolean {
    return type === 'isbn';
  }

  supportsFormat(format: MarcFormat): boolean {
    return format === 'UNIMARC';
  }
}
