import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export const PHYSICAL_DESCRIPTION_SUBFIELDS = ['a', 'b', 'c', 'd'] as const;
export type PhysicalDescriptionSubfield = (typeof PHYSICAL_DESCRIPTION_SUBFIELDS)[number];

export class PhysicalDescriptionDto {
  @ApiProperty({ enum: PHYSICAL_DESCRIPTION_SUBFIELDS, example: 'a' })
  @IsIn(PHYSICAL_DESCRIPTION_SUBFIELDS)
  subfield!: PhysicalDescriptionSubfield;

  @ApiProperty({ example: '146, [6] p.' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  @IsOptional()
  @IsString()
  source?: string | null;

}

export type PhysicalDescriptionInput = {
  subfield: string;
  value: string;
  sortOrder: number;
  source?: string | null;
  normalizedValue?: string | null;
};
