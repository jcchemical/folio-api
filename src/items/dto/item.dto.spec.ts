import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateItemDto, UpdateItemDto } from './item.dto.js';

describe('CreateItemDto', () => {
  it('accepts copy-level fields and rejects alternate ownership authorities', async () => {
    const dto = plainToInstance(CreateItemDto, {
      holdingId: 'holding-1',
      label: null,
      status: 'OWNED',
      notes: 'Copy note',
      id: 'forged-id',
      organizationId: 'forged-organization',
      editionId: 'forged-edition',
      libraryId: 'forged-library',
      locationId: 'forged-location',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
    expect(dto).toMatchObject({ holdingId: 'holding-1', notes: 'Copy note' });

    const valid = plainToInstance(CreateItemDto, {
      holdingId: 'holding-1',
      label: null,
      status: 'OWNED',
      notes: 'Copy note',
    });
    expect(await validate(valid, { whitelist: true })).toEqual([]);
  });

  it('requires a non-empty holdingId', async () => {
    for (const holdingId of [undefined, '', '   ', 42]) {
      const dto = plainToInstance(CreateItemDto, { holdingId });
      expect(await validate(dto)).not.toEqual([]);
    }
  });

  it('allows optional nullable copy text but requires any supplied status to be non-null and non-empty', async () => {
    const nullable = plainToInstance(CreateItemDto, {
      holdingId: 'holding-1',
      label: null,
      notes: null,
    });
    expect(await validate(nullable)).toEqual([]);

    for (const status of ['', null, 123]) {
      const invalidStatus = plainToInstance(CreateItemDto, {
        holdingId: 'holding-1',
        status,
      });
      expect(await validate(invalidStatus)).not.toEqual([]);
    }
  });
});

describe('UpdateItemDto', () => {
  it('accepts only mutable fields and strips identity, relationship, and timestamps', async () => {
    const dto = plainToInstance(UpdateItemDto, {
      label: null,
      status: null,
      id: 'forged-id',
      holdingId: 'forged-holding',
      editionId: 'forged-edition',
      organizationId: 'forged-organization',
      libraryId: 'forged-library',
      locationId: 'forged-location',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      notes: 'not an allowed DTO field',
    });

    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
    expect(dto).toMatchObject({ label: null, status: null });
  });

  it('allows an empty update and rejects empty or non-string status values', async () => {
    expect(await validate(plainToInstance(UpdateItemDto, {}))).toEqual([]);
    for (const status of ['', null, 123]) {
      const dto = plainToInstance(UpdateItemDto, { status });
      expect(await validate(dto)).not.toEqual([]);
    }
  });
});
