import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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
  @IsDateString()
  publishDate?: string | null;

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
  pages?: number | null;

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
