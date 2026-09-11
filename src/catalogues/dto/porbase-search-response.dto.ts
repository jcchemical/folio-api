import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhysicalDescriptionDto } from '../../editions/dto/physical-description.dto.js';
import { CataloguePublicationStatementDto } from './catalogue-publication-statement.dto.js';
import { CatalogueContributionDto } from './catalogue-contribution.dto.js';
import { CatalogueWarningDto } from './catalogue-warning.dto.js';
import { CatalogueTitleDto } from './catalogue-title.dto.js';
import { CatalogueResponsibilityStatementDto } from './catalogue-responsibility-statement.dto.js';
import { CatalogueLanguageDto } from './catalogue-language.dto.js';
import { CatalogueSeriesDto } from './catalogue-series.dto.js';
import { CatalogueNoteDto } from './catalogue-note.dto.js';
import { CatalogueClassificationDto } from './catalogue-classification.dto.js';
import { CatalogueUnmappedFieldDto } from './catalogue-unmapped-field.dto.js';
import { CatalogueEditionStatementDto } from './catalogue-edition-statement.dto.js';
import { CatalogueSourceIdentifierDto } from './catalogue-source-identifier.dto.js';

export type CatalogueResourceType =
  | 'TEXT'
  | 'NOTATED_MUSIC'
  | 'CARTOGRAPHIC'
  | 'SOUND'
  | 'STILL_IMAGE'
  | 'MOVING_IMAGE'
  | 'ELECTRONIC'
  | 'MIXED'
  | 'UNSPECIFIED';

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

  @ApiPropertyOptional({ example: 'PT' })
  country?: string;

  @ApiPropertyOptional({ example: '3664836' })
  recordId?: string;

  @ApiProperty({ type: [CatalogueSourceIdentifierDto] })
  sourceIdentifiers!: CatalogueSourceIdentifierDto[];

  @ApiProperty({ type: [CatalogueTitleDto] })
  titles!: CatalogueTitleDto[];

  @ApiProperty({ type: [CatalogueResponsibilityStatementDto] })
  responsibilityStatements!: CatalogueResponsibilityStatementDto[];

  @ApiProperty({ type: [CatalogueLanguageDto] })
  languages!: CatalogueLanguageDto[];

  @ApiProperty({ type: [CatalogueEditionStatementDto] })
  editionStatements!: CatalogueEditionStatementDto[];

  @ApiPropertyOptional({ nullable: true })
  generalMaterialDesignation?: string | null;

  @ApiProperty({
    enum: [
      'TEXT',
      'NOTATED_MUSIC',
      'CARTOGRAPHIC',
      'SOUND',
      'STILL_IMAGE',
      'MOVING_IMAGE',
      'ELECTRONIC',
      'MIXED',
      'UNSPECIFIED',
    ],
  })
  resourceType!: CatalogueResourceType;

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

  @ApiProperty({ type: [CatalogueSeriesDto] })
  series!: CatalogueSeriesDto[];

  @ApiProperty({ type: [CatalogueNoteDto] })
  notes!: CatalogueNoteDto[];

  @ApiProperty({ type: [CatalogueClassificationDto] })
  classifications!: CatalogueClassificationDto[];

  @ApiProperty({ type: [CatalogueUnmappedFieldDto] })
  unmappedFields!: CatalogueUnmappedFieldDto[];
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
