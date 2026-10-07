import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class CreateExternalIdentifierDto {
  @ApiProperty({ example: 'ISBN-13' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: '9789898236005' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  @IsOptional()
  @IsString()
  source?: string | null;

  @ApiProperty({ example: 'edition_cuid' })
  @IsString()
  @IsNotEmpty()
  editionId!: string;
}

export class UpdateExternalIdentifierDto extends PartialType(
  OmitType(CreateExternalIdentifierDto, ['editionId'] as const),
) {}

export class ExternalIdentifierListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'edition_cuid' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  editionId?: string;
}
