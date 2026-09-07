import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  CreateExternalIdentifierDto,
) {}
