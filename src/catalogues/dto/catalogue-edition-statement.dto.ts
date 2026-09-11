import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueEditionStatementDto {
  @ApiProperty()
  value!: string;

  @ApiProperty({ enum: ['EDITION', 'OTHER', 'RESPONSIBILITY'] })
  kind!: 'EDITION' | 'OTHER' | 'RESPONSIBILITY';

  @ApiPropertyOptional({ nullable: true })
  label?: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceTag?: string | null;
}
