import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogueLanguageDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({
    enum: ['TEXT', 'ORIGINAL_LANGUAGE', 'PARALLEL_TEXT', 'SUBTITLES'],
  })
  role!: 'TEXT' | 'ORIGINAL_LANGUAGE' | 'PARALLEL_TEXT' | 'SUBTITLES';

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceCode?: string | null;
}
