import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class HoldingListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'edition_cuid' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  editionId?: string;

  @ApiPropertyOptional({ example: 'location_cuid' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  locationId?: string;
}

export class CreateHoldingDto {
  @ApiProperty({ example: 'edition_cuid' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  editionId!: string;

  @ApiProperty({ example: 'location_cuid' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  locationId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'QA76.73.D3' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  callNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateHoldingDto extends PartialType(
  OmitType(CreateHoldingDto, ['editionId', 'locationId'] as const),
) {}
