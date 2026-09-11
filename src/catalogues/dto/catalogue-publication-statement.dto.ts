import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Read-only shape for parsed/preview data; distinct from the editions write
// DTO, which must not accept client-controlled source or normalizedValue.
export class CataloguePublicationStatementPartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' })
  subfield!: string;

  @ApiProperty({ example: 'Coimbra' })
  value!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Groups subfields belonging to the same 210 place/name/date occurrence (e.g. publication vs. distribution).',
  })
  groupIndex?: number;

  @ApiPropertyOptional({ example: '2009', nullable: true })
  normalizedValue?: string | null;
}

export class CataloguePublicationStatementDto {
  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: ' ' })
  indicator1!: string;

  @ApiProperty({ example: '9' })
  indicator2!: string;

  @ApiProperty({ type: [CataloguePublicationStatementPartDto] })
  parts!: CataloguePublicationStatementPartDto[];

  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  source?: string | null;
}
