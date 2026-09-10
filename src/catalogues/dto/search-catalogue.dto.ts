import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CatalogueSearchQueryDto {
  @ApiProperty({ example: '9789724426495' })
  @IsString()
  @IsNotEmpty()
  isbn!: string;
}

export class SearchCatalogueDto {
  @ApiPropertyOptional({ example: 'porbase' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceId?: string;

  @ApiProperty({ type: CatalogueSearchQueryDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CatalogueSearchQueryDto)
  query!: CatalogueSearchQueryDto;
}
