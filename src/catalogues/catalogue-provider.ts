import type { ImportPreviewResponseDto } from './dto/import-preview-response.dto.js';
import type {
  CatalogueImportDto,
  CatalogueImportResponseDto,
} from './dto/catalogue-import.dto.js';

export type SearchType = 'isbn' | 'title' | 'author' | 'keyword';
export type MarcFormat = 'UNIMARC' | 'MARC21' | 'OTHER';

export type CatalogueSearchQuery =
  | { type: 'isbn'; isbn: string }
  | { type: 'title'; title: string }
  | { type: 'author'; author: string }
  | { type: 'keyword'; keyword: string };

// The generic search/preview result any catalogue provider must return.
export type CatalogueSearchResult = ImportPreviewResponseDto;

export interface CatalogueProvider {
  readonly id: string;
  readonly name: string;
  readonly format: MarcFormat;

  searchPreview(query: CatalogueSearchQuery): Promise<CatalogueSearchResult>;
  import(
    userId: string,
    input: CatalogueImportDto,
  ): Promise<CatalogueImportResponseDto>;
  supportsSearchType(type: SearchType): boolean;
  supportsFormat(format: MarcFormat): boolean;
}
