import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkItemSource, WorkItemStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class CreateWorkItemDto {
  @ApiProperty({ description: 'Capture context only; not an export source.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  rawValue!: string;
}

export class TransitionWorkItemDto {
  @ApiProperty({ enum: WorkItemStatus })
  @IsEnum(WorkItemStatus)
  status!: WorkItemStatus;
}

export class WorkItemListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WorkItemStatus })
  @IsOptional()
  @IsEnum(WorkItemStatus)
  status?: WorkItemStatus;
}

export class WorkItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty({ enum: WorkItemSource })
  source!: WorkItemSource;

  @ApiProperty()
  rawValue!: string;

  @ApiProperty({ type: String, nullable: true })
  matchedItemId!: string | null;

  @ApiProperty({ enum: WorkItemStatus })
  status!: WorkItemStatus;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class WorkItemPageDto {
  @ApiProperty({ type: [WorkItemDto] })
  items!: WorkItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasMore!: boolean;
}
