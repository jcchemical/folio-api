import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/i, {
    message: 'cursor must be a valid resource cursor',
  })
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 25;
}

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
