import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const PHYSICAL_DESCRIPTION_SUBFIELDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export type PhysicalDescriptionSubfield = (typeof PHYSICAL_DESCRIPTION_SUBFIELDS)[number];

export class PhysicalDescriptionPartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' })
  @Transform(({ value }) => typeof value === 'string' ? value.toLowerCase() : value)
  @IsString()
  @Matches(/^[a-z0-9]$/)
  subfield!: string;

  @ApiProperty({ example: '146, [6] p.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

}

export class PhysicalDescriptionDto {
  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiProperty({ type: [PhysicalDescriptionPartDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PhysicalDescriptionPartDto)
  parts!: PhysicalDescriptionPartDto[];

  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  @IsOptional()
  @IsString()
  source?: string | null;
}

export type PhysicalDescriptionPartInput = {
  subfield: string;
  value: string;
  sortOrder: number;
};

export type PhysicalDescriptionInput = {
  sortOrder: number;
  source?: string | null;
  parts: PhysicalDescriptionPartInput[];
};
