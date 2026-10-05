import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateItemDto, UpdateItemDto } from './item.dto.js';

describe('CreateItemDto', () => {
  it('accepts only create fields and strips server-controlled fields', async () => {
    const dto = plainToInstance(CreateItemDto, {
      editionId: 'edition-1',
      label: null,
      location: 'Shelf A',
      status: 'OWNED',
      id: 'forged-id',
      organizationId: 'forged-organization',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      notes: 'not an allowed DTO field',
    });

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto).toEqual({
      editionId: 'edition-1',
      label: null,
      location: 'Shelf A',
      status: 'OWNED',
    });
  });

  it('requires a non-empty editionId', async () => {
    for (const editionId of [undefined, '', '   ', 42]) {
      const dto = plainToInstance(CreateItemDto, { editionId });
      expect(await validate(dto)).not.toEqual([]);
    }
  });

  it('allows optional nullable label, location, and status but rejects empty status', async () => {
    const nullable = plainToInstance(CreateItemDto, {
      editionId: 'edition-1',
      label: null,
      location: null,
      status: null,
    });
    expect(await validate(nullable)).toEqual([]);

    const emptyStatus = plainToInstance(CreateItemDto, {
      editionId: 'edition-1',
      status: '',
    });
    expect(await validate(emptyStatus)).not.toEqual([]);
  });
});

describe('UpdateItemDto', () => {
  it('accepts only mutable fields and strips identity, relationship, and timestamps', async () => {
    const dto = plainToInstance(UpdateItemDto, {
      label: null,
      location: 'Shelf B',
      status: null,
      id: 'forged-id',
      editionId: 'forged-edition',
      organizationId: 'forged-organization',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      notes: 'not an allowed DTO field',
    });

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto).toEqual({ label: null, location: 'Shelf B', status: null });
  });

  it('allows an empty update and rejects empty or non-string status values', async () => {
    expect(await validate(plainToInstance(UpdateItemDto, {}))).toEqual([]);
    for (const status of ['', 123]) {
      const dto = plainToInstance(UpdateItemDto, { status });
      expect(await validate(dto)).not.toEqual([]);
    }
  });
});
