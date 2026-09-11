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
import type { CatalogueResourceType } from './porbase-search-response.dto.js';

export class ImportPreviewWorkDto {
  @ApiProperty({ example: 'Vida e andanças de Alexis Zorbás' })
  title!: string;

  @ApiPropertyOptional({ example: 'Uma edição anotada' })
  subtitle?: string;
}

export class ImportPreviewEditionDto {
  @ApiProperty({ example: 'Vida e andanças de Alexis Zorbás' })
  title!: string;

  @ApiPropertyOptional({ example: '9789724426495' })
  isbn10?: string;

  @ApiPropertyOptional({ example: '9789724426495' })
  isbn13?: string;

  @ApiPropertyOptional({ example: 'Edições 70' })
  publisher?: string;

  @ApiPropertyOptional({ example: '2022', nullable: true })
  publicationDate?: string | null;

  @ApiPropertyOptional({ example: 'por' })
  language?: string;

  @ApiPropertyOptional({ example: 'Coimbra' })
  placeOfPublication?: string;

  @ApiPropertyOptional({ example: 'Paperback' })
  format?: string;

  @ApiProperty({ type: [CatalogueTitleDto] })
  titles!: CatalogueTitleDto[];

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

  @ApiPropertyOptional({ example: 383, nullable: true })
  pageCount?: number | null;

  @ApiProperty({ type: [PhysicalDescriptionDto], required: false })
  physicalDescriptions?: PhysicalDescriptionDto[];

  @ApiProperty({ type: [CataloguePublicationStatementDto], required: false })
  publicationStatements?: CataloguePublicationStatementDto[];

  @ApiProperty({ type: [CatalogueLanguageDto] })
  languages!: CatalogueLanguageDto[];

  @ApiProperty({ type: [CatalogueSeriesDto] })
  series!: CatalogueSeriesDto[];

  @ApiProperty({ type: [CatalogueNoteDto] })
  notes!: CatalogueNoteDto[];

  @ApiProperty({ type: [CatalogueClassificationDto] })
  classifications!: CatalogueClassificationDto[];
}

export class ImportPreviewContributorDto {
  @ApiProperty({ example: 'Kazantzákis, Níkos' })
  name!: string;

  @ApiProperty({ example: 'author' })
  role!: string;
}

export class ImportPreviewExternalIdentifierDto {
  @ApiProperty({ example: 'ISBN-13' })
  type!: string;

  @ApiProperty({ example: '9789724426495' })
  value!: string;

  @ApiProperty({ example: 'PORBASE' })
  source!: string;
}

export class ImportPreviewBibliographicRecordDto {
  @ApiProperty({ enum: ['MARCXCHANGE', 'MARC_TEXT'] })
  format!: 'MARCXCHANGE' | 'MARC_TEXT';

  @ApiProperty({ example: 'UNIMARC' })
  schema!: string;

  @ApiProperty({ example: 'PORBASE' })
  source!: string;

  @ApiProperty({ example: 'porbase' })
  sourceId!: string;

  @ApiPropertyOptional({ example: '3664836' })
  remoteId?: string;

  @ApiProperty({ description: 'Original PORBASE response body.' })
  rawContent!: string;
}

export class ImportPreviewResponseDto {
  @ApiProperty({ example: 'porbase' })
  sourceId!: string;

  @ApiProperty({ type: ImportPreviewWorkDto })
  work!: ImportPreviewWorkDto;

  @ApiProperty({ type: ImportPreviewEditionDto })
  edition!: ImportPreviewEditionDto;

  @ApiProperty({ type: [CatalogueResponsibilityStatementDto] })
  responsibilityStatements!: CatalogueResponsibilityStatementDto[];

  @ApiProperty({ type: [ImportPreviewContributorDto] })
  contributors!: ImportPreviewContributorDto[];

  @ApiProperty({ type: [CatalogueContributionDto] })
  contributions!: CatalogueContributionDto[];

  @ApiProperty({ type: [ImportPreviewExternalIdentifierDto] })
  externalIdentifiers!: ImportPreviewExternalIdentifierDto[];

  @ApiProperty({ type: ImportPreviewBibliographicRecordDto })
  bibliographicRecord!: ImportPreviewBibliographicRecordDto;

  @ApiProperty({ type: [CatalogueWarningDto], example: [] })
  warnings!: CatalogueWarningDto[];

  @ApiProperty({ type: [CatalogueUnmappedFieldDto] })
  unmappedFields!: CatalogueUnmappedFieldDto[];
}
