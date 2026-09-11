import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueContributionSourcePartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' }) code!: string;
  @ApiProperty({ example: 'Kazantzákis' }) value!: string;
  @ApiProperty({ example: 0 }) sortOrder!: number;
}

export class CatalogueContributionDto {
  @ApiProperty({ enum: ['WORK'] }) targetScope!: 'WORK';
  @ApiProperty({ enum: ['PERSON', 'CORPORATE_BODY', 'UNKNOWN'] }) kind!:
    'PERSON' | 'CORPORATE_BODY' | 'UNKNOWN';
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional() roleLabel?: string;
  @ApiPropertyOptional() relationshipCodeScheme?: string;
  @ApiPropertyOptional({ nullable: true }) authorityId?: string | null;
  @ApiProperty({ enum: ['700', '701', '702', '710', '711', '712', '713'] })
  sourceTag!: '700' | '701' | '702' | '710' | '711' | '712' | '713';
  @ApiProperty() indicator1!: string;
  @ApiProperty() indicator2!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ type: [CatalogueContributionSourcePartDto] })
  sourceParts!: CatalogueContributionSourcePartDto[];
}
