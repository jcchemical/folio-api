import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueEditionStatementDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceCode?: string | null;
}
