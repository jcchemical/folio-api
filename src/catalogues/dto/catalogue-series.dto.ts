import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueSeriesDto {
  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  parallelTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  issn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  volumeNumber?: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceTag?: string | null;
}
