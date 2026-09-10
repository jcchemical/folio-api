import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PorbaseImportDto } from './porbase-import.dto.js';

export class ImportCatalogueDto extends PorbaseImportDto {
  @ApiPropertyOptional({ example: 'porbase' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceId?: string;
}
