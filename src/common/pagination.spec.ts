import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { paginate, paginationArgs } from './pagination.js';

describe('cursor pagination', () => {
  it('returns a bounded page with nextCursor and hasMore', () => {
    const result = paginate(
      [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      2,
    );

    expect(result).toEqual({
      items: [{ id: 'c1' }, { id: 'c2' }],
      nextCursor: 'c2',
      hasMore: true,
    });
  });

  it('returns no next cursor on the last page', () => {
    expect(paginate([{ id: 'c1' }], 2)).toEqual({
      items: [{ id: 'c1' }],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('never requests more than the configured maximum', () => {
    expect(paginationArgs({ limit: 500 }).prisma.take).toBe(101);
    expect(paginationArgs({ limit: 2, cursor: 'c1' }).prisma).toEqual({
      take: 3,
      cursor: { id: 'c1' },
      skip: 1,
    });
  });

  it('rejects an invalid cursor and limit through class-validator', async () => {
    const query = plainToInstance(PaginationQueryDto, {
      cursor: 'invalid-cursor',
      limit: 101,
    });

    const errors = await validate(query);

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(['cursor', 'limit']),
    );
  });
});
