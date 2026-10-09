import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AgentDraftDto {
  @ApiProperty({ enum: ['PERSON', 'CORPORATE_BODY', 'UNKNOWN'] })
  @IsIn(['PERSON', 'CORPORATE_BODY', 'UNKNOWN'])
  kind!: 'PERSON' | 'CORPORATE_BODY' | 'UNKNOWN';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName!: string;
}

export class CreateContributionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  editionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ type: AgentDraftDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgentDraftDto)
  agent?: AgentDraftDto;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleLabel?: string;
}
export class UpdateContributionDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'An empty string clears the label.' })
  @IsOptional()
  @IsString()
  roleLabel?: string;
}

export class ContributionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  workId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  editionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  agentId?: string;
}
