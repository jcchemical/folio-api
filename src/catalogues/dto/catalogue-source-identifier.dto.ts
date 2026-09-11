import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueSourceIdentifierDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional({ nullable: true })
  source?: string | null;

  @ApiProperty()
  sortOrder!: number;
}
