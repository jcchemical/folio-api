import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type CatalogueUnmappedFieldReason =
  'UNSUPPORTED' | 'LOCAL' | 'AMBIGUOUS' | 'NOT_YET_MODELED';

export class CatalogueUnmappedSubfieldDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  sortOrder!: number;
}

export class CatalogueUnmappedFieldDto {
  @ApiProperty()
  tag!: string;

  @ApiPropertyOptional({ nullable: true })
  indicator1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  indicator2?: string | null;

  @ApiProperty()
  occurrence!: number;

  @ApiProperty({
    enum: ['UNSUPPORTED', 'LOCAL', 'AMBIGUOUS', 'NOT_YET_MODELED'],
  })
  reason!: CatalogueUnmappedFieldReason;

  @ApiProperty({ type: [CatalogueUnmappedSubfieldDto] })
  subfields!: CatalogueUnmappedSubfieldDto[];
}
