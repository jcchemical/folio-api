import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'library_cuid' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  libraryId!: string;

  @ApiProperty({ example: 'Depósito' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
}

export class UpdateLocationDto extends PartialType(
  OmitType(CreateLocationDto, ['libraryId'] as const),
) {}
