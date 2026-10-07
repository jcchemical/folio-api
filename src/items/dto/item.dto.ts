import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  @ApiPropertyOptional({ nullable: true, example: 'OWNED' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  status?: string | null;
}

export class UpdateItemDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'OWNED' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  status?: string | null;
}
