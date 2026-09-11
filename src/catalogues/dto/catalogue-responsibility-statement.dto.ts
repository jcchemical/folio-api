import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueResponsibilityStatementDto {
  @ApiProperty({ enum: ['STATEMENT', 'SUBSEQUENT_STATEMENT'] })
  label!: 'STATEMENT' | 'SUBSEQUENT_STATEMENT';

  @ApiProperty()
  value!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceTag?: string | null;
}
