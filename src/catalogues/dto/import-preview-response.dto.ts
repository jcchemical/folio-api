import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhysicalDescriptionDto } from '../../editions/dto/physical-description.dto.js';
import { CataloguePublicationStatementDto } from './catalogue-publication-statement.dto.js';
import { CatalogueContributionDto } from './catalogue-contribution.dto.js';
import { CatalogueWarningDto } from './catalogue-warning.dto.js';

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

  @ApiPropertyOptional({ example: 383, nullable: true })
  pageCount?: number | null;

  @ApiProperty({ type: [PhysicalDescriptionDto], required: false })
  physicalDescriptions?: PhysicalDescriptionDto[];

  @ApiProperty({ type: [CataloguePublicationStatementDto], required: false })
  publicationStatements?: CataloguePublicationStatementDto[];
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
}
