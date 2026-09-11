import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhysicalDescriptionDto } from '../../editions/dto/physical-description.dto.js';
import { CataloguePublicationStatementDto } from './catalogue-publication-statement.dto.js';
import { CatalogueContributionDto } from './catalogue-contribution.dto.js';
import { CatalogueWarningDto } from './catalogue-warning.dto.js';

export class PorbaseBibliographicFieldsDto {
  @ApiPropertyOptional({ example: 'O Principezinho' })
  title?: string;

  @ApiProperty({ type: [String], example: ['Saint-Exupéry, Antoine de'] })
  authors!: string[];

  @ApiPropertyOptional({ example: '978-972-44-2649-5' })
  isbn?: string;

  @ApiPropertyOptional({ example: 'Asa' })
  publisher?: string;

  @ApiPropertyOptional({ example: '2022', nullable: true })
  publicationDate?: string | null;

  @ApiPropertyOptional({ example: 'por' })
  language?: string;

  @ApiPropertyOptional({ example: '3664836' })
  recordId?: string;

  @ApiPropertyOptional({ example: ['Carlos Leite'] })
  translators?: string[];

  @ApiProperty({ type: [CatalogueContributionDto], required: false })
  contributions?: CatalogueContributionDto[];

  @ApiPropertyOptional({ example: 'Coimbra' })
  placeOfPublication?: string;

  @ApiPropertyOptional({ example: '383 p.' })
  extent?: string;

  @ApiProperty({ type: [PhysicalDescriptionDto], required: false })
  physicalDescriptions?: PhysicalDescriptionDto[];

  @ApiProperty({ type: [CataloguePublicationStatementDto], required: false })
  publicationStatements?: CataloguePublicationStatementDto[];

  @ApiPropertyOptional({ example: ['4-(1)-40-5-39'] })
  shelfmarks?: string[];

  @ApiPropertyOptional({
    example: ['http://id.bnportugal.gov.pt/bib/porbase/3664836'],
  })
  identifiers?: string[];
}

export type PorbaseDetectedFormat =
  'MARCXCHANGE_XML' | 'MARC_TEXT' | 'UNKNOWN' | 'ERROR';

export class PorbaseSearchResponseDto {
  @ApiProperty({ example: 'PORBASE' })
  source!: string;

  @ApiProperty({ example: '9789724426495' })
  query!: string;

  @ApiProperty({ example: true })
  found!: boolean;

  @ApiProperty({ enum: ['MARCXCHANGE_XML', 'MARC_TEXT', 'UNKNOWN', 'ERROR'] })
  detectedFormat!: PorbaseDetectedFormat;

  @ApiProperty({ example: 'Unimarc' })
  format!: string;

  @ApiProperty({ example: 'MARCXchange' })
  schema!: string;

  @ApiProperty({ description: 'Original response body from PORBASE.' })
  rawContent!: string;

  @ApiPropertyOptional({ example: false })
  rawContentTruncated?: boolean;

  @ApiProperty({ type: PorbaseBibliographicFieldsDto })
  metadata!: PorbaseBibliographicFieldsDto;

  @ApiProperty({ type: PorbaseBibliographicFieldsDto, required: false })
  fields!: PorbaseBibliographicFieldsDto;

  @ApiProperty({ type: [CatalogueWarningDto], example: [] })
  warnings!: CatalogueWarningDto[];
}
