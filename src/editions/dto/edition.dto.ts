import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsBibliographicDate } from '../../common/bibliographic-date.js';
import { PhysicalDescriptionDto } from './physical-description.dto.js';

export class CreateEditionDto {
  @ApiProperty({ example: 'Título da edição' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  isbn10?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  isbn13?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  publisher?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBibliographicDate()
  publicationDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  format?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ type: [PhysicalDescriptionDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PhysicalDescriptionDto)
  physicalDescriptions?: PhysicalDescriptionDto[];
}

export class UpdateEditionDto extends PartialType(CreateEditionDto) {}

export class CreateEditionRequestDto extends CreateEditionDto {
  @ApiProperty({ example: 'work_cuid' })
  @IsString()
  @IsNotEmpty()
  workId!: string;
}
