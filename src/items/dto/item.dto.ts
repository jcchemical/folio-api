import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'holding_cuid' })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  holdingId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiPropertyOptional({ example: 'OWNED' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  status?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateItemDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiPropertyOptional({ example: 'OWNED' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  status?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
