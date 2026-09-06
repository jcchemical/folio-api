import { MAX_PAGE_SIZE, type PaginatedResult } from './dto/pagination-query.dto.js';

export type PaginationInput = {
  cursor?: string;
  limit?: number;
};

export function paginationArgs(query: PaginationInput) {
  const limit = Math.min(Math.max(query.limit ?? 25, 1), MAX_PAGE_SIZE);

  return {
    limit,
    prisma: {
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    },
  };
}

export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    hasMore,
  };
}
