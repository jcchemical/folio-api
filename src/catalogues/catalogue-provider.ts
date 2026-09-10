import type { ImportPreviewResponseDto } from './dto/import-preview-response.dto.js';
import type {
  PorbaseImportDto,
  PorbaseImportResponseDto,
} from './dto/porbase-import.dto.js';

export type SearchType = 'isbn' | 'title' | 'author' | 'keyword';
export type MarcFormat = 'UNIMARC' | 'MARC21' | 'OTHER';

export interface CatalogueSearchQuery {
  isbn?: string;
}

export type CataloguePreview = ImportPreviewResponseDto;
export type ImportedCatalogueRecord = PorbaseImportResponseDto;
export type CatalogueImportInput = PorbaseImportDto;

export interface CatalogueProvider {
  readonly id: string;
  readonly name: string;
  readonly format: MarcFormat;

  searchPreview(query: CatalogueSearchQuery): Promise<CataloguePreview>;
  import(
    userId: string,
    input: CatalogueImportInput,
  ): Promise<ImportedCatalogueRecord>;
  supportsSearchType(type: SearchType): boolean;
  supportsFormat(format: MarcFormat): boolean;
}
