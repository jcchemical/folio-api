import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import {
  EXTERNAL_IDENTIFIER_ENTITY_TYPES,
  type ExternalIdentifierEntityType,
} from '../external_identifiers.service.js';

export class CreateExternalIdentifierDto {
  @ApiProperty({ enum: EXTERNAL_IDENTIFIER_ENTITY_TYPES, example: 'Edition' })
  @IsString()
  @IsIn(EXTERNAL_IDENTIFIER_ENTITY_TYPES)
  entityType!: ExternalIdentifierEntityType;

  @ApiProperty({ example: 'c123456789012345678901234' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  entityId!: string;

  @ApiProperty({ example: 'isbn-13' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  authority!: string;

  @ApiProperty({ example: '9789898236005' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  value!: string;
}

export class UpdateExternalIdentifierDto {
  @ApiPropertyOptional({ example: 'isbn-13' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  authority?: string;

  @ApiPropertyOptional({ example: '9789898236005' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  value?: string;
}

export class ExternalIdentifierListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EXTERNAL_IDENTIFIER_ENTITY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(EXTERNAL_IDENTIFIER_ENTITY_TYPES)
  entityType?: ExternalIdentifierEntityType;

  @ApiPropertyOptional({ example: 'c123456789012345678901234' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  entityId?: string;

  @ApiPropertyOptional({ example: 'isbn-13' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  authority?: string;
}

export class ExternalIdentifierDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EXTERNAL_IDENTIFIER_ENTITY_TYPES })
  entityType!: ExternalIdentifierEntityType;

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ example: 'isbn-13' })
  authority!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ExternalIdentifierPageDto {
  @ApiProperty({ type: [ExternalIdentifierDto] })
  items!: ExternalIdentifierDto[];

  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasMore!: boolean;
}
