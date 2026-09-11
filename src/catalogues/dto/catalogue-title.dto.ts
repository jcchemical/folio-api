import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type CatalogueTitleType = 'MAIN' | 'PARALLEL' | 'VARIANT' | 'OTHER';

export class CatalogueTitleDto {
  @ApiProperty({ enum: ['MAIN', 'PARALLEL', 'VARIANT', 'OTHER'] })
  type!: CatalogueTitleType;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional({ nullable: true })
  subtitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  language?: string | null;

  @ApiPropertyOptional({ nullable: true })
  partNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  partName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceTag?: string | null;

  @ApiProperty()
  sortOrder!: number;
}
