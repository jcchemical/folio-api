import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PorbaseContributionSourcePartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' }) code!: string;
  @ApiProperty({ example: 'Kazantzákis' }) value!: string;
  @ApiProperty({ example: 0 }) sortOrder!: number;
}

export class PorbaseContributionDto {
  @ApiProperty({ enum: ['WORK'] }) targetScope!: 'WORK';
  @ApiProperty({ enum: ['PERSON', 'CORPORATE_BODY', 'UNKNOWN'] }) kind!: 'PERSON' | 'CORPORATE_BODY' | 'UNKNOWN';
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional() roleLabel?: string;
  @ApiPropertyOptional() relationshipCodeScheme?: string;
  @ApiProperty({ enum: ['700', '701', '702'] }) sourceTag!: '700' | '701' | '702';
  @ApiProperty() indicator1!: string;
  @ApiProperty() indicator2!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ type: [PorbaseContributionSourcePartDto] }) sourceParts!: PorbaseContributionSourcePartDto[];
}

export class PorbasePhysicalDescriptionPartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' })
  subfield!: string;

  @ApiProperty({ example: '383 p.' })
  value!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiPropertyOptional({ example: '383 p.', nullable: true })
  normalizedValue?: string | null;
}

export class PorbasePublicationStatementPartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' })
  subfield!: string;
  @ApiProperty({ example: 'Coimbra' })
  value!: string;
  @ApiProperty({ example: 0 })
  sortOrder!: number;
  @ApiPropertyOptional({ nullable: true })
  normalizedValue?: string | null;
}

export class PorbasePublicationStatementDto {
  @ApiProperty({ example: 0 })
  sortOrder!: number;
  @ApiProperty({ example: ' ' })
  indicator1!: string;
  @ApiProperty({ example: '9' })
  indicator2!: string;
  @ApiProperty({ type: [PorbasePublicationStatementPartDto] })
  parts!: PorbasePublicationStatementPartDto[];
  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  source?: string | null;
}

export class PorbasePhysicalDescriptionDto {
  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  source?: string | null;

  @ApiProperty({ type: [PorbasePhysicalDescriptionPartDto] })
  parts!: PorbasePhysicalDescriptionPartDto[];
}

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

  @ApiProperty({ type: [PorbaseContributionDto], required: false })
  contributions?: PorbaseContributionDto[];

  @ApiPropertyOptional({ example: 'Coimbra' })
  placeOfPublication?: string;

  @ApiPropertyOptional({ example: '383 p.' })
  extent?: string;

  @ApiProperty({ type: [PorbasePhysicalDescriptionDto], required: false })
  physicalDescriptions?: PorbasePhysicalDescriptionDto[];

  @ApiProperty({ type: [PorbasePublicationStatementDto], required: false })
  publicationStatements?: PorbasePublicationStatementDto[];

  @ApiPropertyOptional({ example: ['4-(1)-40-5-39'] })
  shelfmarks?: string[];

  @ApiPropertyOptional({
    example: ['http://id.bnportugal.gov.pt/bib/porbase/3664836'],
  })
  identifiers?: string[];
}

export type PorbaseDetectedFormat =
  'MARCXCHANGE_XML' | 'MARC_TEXT' | 'UNKNOWN' | 'ERROR';

export type PorbaseWarningType =
  | 'normalization'
  | 'parse_error'
  | 'missing_field'
  | 'provider_error'
  | 'parse_warning';

export type PorbaseWarningCode =
  | 'PORBASE_EMPTY_RESPONSE'
  | 'PORBASE_RECORD_NOT_FOUND'
  | 'PORBASE_PROVIDER_ERROR'
  | 'PORBASE_INVALID_RESPONSE'
  | 'PORBASE_PARSE_ERROR'
  | 'PORBASE_PARSE_WARNING'
  | 'PORBASE_NORMALIZATION'
  | 'PORBASE_MISSING_FIELD'
  | 'PUBLICATION_DATE_NORMALIZED'
  | 'PUBLICATION_SCALAR_DIVERGENCE';

export class PorbaseWarningDto {
  @ApiProperty({ example: 'PORBASE_NORMALIZATION' })
  code!: PorbaseWarningCode;

  @ApiPropertyOptional({ example: 'edition.publicationDate' })
  field?: string;

  @ApiProperty({
    example: "Data normalizada de 'D.L. 2009' para '2009'",
  })
  message!: string;

  @ApiPropertyOptional({ example: 'D.L. 2009' })
  original?: string;

  @ApiPropertyOptional({ example: '2009' })
  normalized?: string;

  @ApiProperty({
    enum: [
      'normalization',
      'parse_error',
      'missing_field',
      'provider_error',
      'parse_warning',
    ],
    example: 'normalization',
  })
  type!: PorbaseWarningType;
}

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

  @ApiProperty({ type: [PorbaseWarningDto], example: [] })
  warnings!: PorbaseWarningDto[];
}
