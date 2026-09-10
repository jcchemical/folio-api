import type { ImportPreviewResponseDto } from './dto/import-preview-response.dto.js';
import type {
  PorbaseImportDto,
  PorbaseImportResponseDto,
} from './dto/porbase-import.dto.js';

export type SearchType = 'isbn' | 'title' | 'author' | 'keyword';
export type MarcFormat = 'UNIMARC' | 'MARC21' | 'OTHER';

export type CatalogueSearchQuery =
  | { type: 'isbn'; isbn: string }
  | { type: 'title'; title: string }
  | { type: 'author'; author: string }
  | { type: 'keyword'; keyword: string };

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
