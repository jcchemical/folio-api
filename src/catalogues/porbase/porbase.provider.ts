import { HttpStatus, Injectable } from '@nestjs/common';
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
import { ApiException, API_ERROR_CODES } from '../../common/api-errors.js';

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
    switch (query.type) {
      case 'isbn':
        return this.importPreviewService.createPreview(query.isbn);
      case 'title':
      case 'author':
      case 'keyword':
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          API_ERROR_CODES.CATALOGUE_SEARCH_TYPE_UNSUPPORTED,
          `PORBASE does not support ${query.type} searches.`,
        );
    }
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
