import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CatalogueProvider,
  CatalogueSearchQuery,
  CatalogueSearchResult,
  MarcFormat,
  SearchType,
} from '../catalogue-provider.js';
import type {
  CatalogueImportDto,
  CatalogueImportResponseDto,
} from '../dto/catalogue-import.dto.js';
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

  async searchPreview(
    query: CatalogueSearchQuery,
  ): Promise<CatalogueSearchResult> {
    switch (query.type) {
      case 'isbn': {
        const result = await this.importPreviewService.createPreview(
          query.isbn,
        );
        return { ...result, sourceId: this.id };
      }
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

  async import(
    userId: string,
    input: CatalogueImportDto,
  ): Promise<CatalogueImportResponseDto> {
    const result = await this.porbaseImportService.import(userId, input);
    return { ...result, sourceId: this.id };
  }

  supportsSearchType(type: SearchType): boolean {
    return type === 'isbn';
  }

  supportsFormat(format: MarcFormat): boolean {
    return format === 'UNIMARC';
  }
}
