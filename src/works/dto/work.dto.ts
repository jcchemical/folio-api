import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateEditionDto } from '../../editions/dto/edition.dto.js';

export class CreateWorkDto {
  @ApiProperty({ example: 'Os Maias' })
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
  organizationId?: string;

  @ApiPropertyOptional({ type: [CreateEditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEditionDto)
  editions?: CreateEditionDto[];
}

export class UpdateWorkDto extends PartialType(CreateWorkDto) {}
