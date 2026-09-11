import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueClassificationDto {
  @ApiProperty()
  notation!: string;

  @ApiProperty()
  system!: string;

  @ApiPropertyOptional({ nullable: true })
  systemEdition?: string | null;

  @ApiPropertyOptional({ nullable: true })
  authorityId?: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  sourceTag!: string;
}
