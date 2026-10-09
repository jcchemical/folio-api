import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentKind } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class CreateAgentDto {
  @ApiProperty({ example: 'Saramago, José' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  displayName!: string;

  @ApiProperty({ enum: AgentKind })
  @IsEnum(AgentKind)
  kind!: AgentKind;
}

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  displayName?: string;

  @ApiPropertyOptional({ enum: AgentKind })
  @IsOptional()
  @IsEnum(AgentKind)
  kind?: AgentKind;
}

export class AgentListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AgentKind })
  @IsOptional()
  @IsEnum(AgentKind)
  kind?: AgentKind;
}

export class AgentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ enum: AgentKind })
  kind!: AgentKind;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  normalizedDisplayName!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AgentPageDto {
  @ApiProperty({ type: [AgentDto] })
  items!: AgentDto[];

  @ApiProperty({ nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasMore!: boolean;
}
