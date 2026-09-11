import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type CatalogueWarningType =
  | 'normalization'
  | 'parse_error'
  | 'missing_field'
  | 'provider_error'
  | 'parse_warning';

// Code values are provider-specific by nature; PORBASE is the only source today.
export type CatalogueWarningCode =
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

export class CatalogueWarningDto {
  @ApiProperty({ example: 'PORBASE_NORMALIZATION' })
  code!: CatalogueWarningCode;

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
  type!: CatalogueWarningType;
}
