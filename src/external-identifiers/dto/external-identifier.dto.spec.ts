import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateExternalIdentifierDto,
  ExternalIdentifierListQueryDto,
  UpdateExternalIdentifierDto,
} from './external-identifier.dto.js';

describe('External Identifier DTOs', () => {
  it('accepts only supported entity types and excludes tenant authority', async () => {
    const valid = plainToInstance(CreateExternalIdentifierDto, {
      entityType: 'Edition',
      entityId: 'c123456789012345678901234',
      authority: 'isbn-13',
      value: '9780000000001',
    });
    expect(await validate(valid, { whitelist: true })).toEqual([]);

    const forged = plainToInstance(CreateExternalIdentifierDto, {
      entityType: 'Edition',
      entityId: 'c123456789012345678901234',
      authority: 'isbn-13',
      value: '9780000000001',
      organizationId: 'forged-org',
    });
    expect(
      await validate(forged, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);

    const unsupported = plainToInstance(CreateExternalIdentifierDto, {
      entityType: 'PatronAccount',
      entityId: 'entity-a',
      authority: 'isbn-13',
      value: '9780000000001',
    });
    expect(await validate(unsupported)).not.toEqual([]);
  });

  it('permits changing authority or value but not the entity binding', async () => {
    const valueOnly = plainToInstance(UpdateExternalIdentifierDto, {
      value: '9780000000002',
    });
    expect(await validate(valueOnly, { whitelist: true })).toEqual([]);

    const rebind = plainToInstance(UpdateExternalIdentifierDto, {
      entityId: 'entity-b',
    });
    expect(
      await validate(rebind, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });

  it('supports only the three documented root filters', async () => {
    const valid = plainToInstance(ExternalIdentifierListQueryDto, {
      entityType: 'Holding',
      entityId: 'holding-a',
      authority: 'oclc',
      limit: '10',
    });
    expect(await validate(valid, { whitelist: true, transform: true })).toEqual(
      [],
    );
    expect(valid.limit).toBe(10);

    const unsupported = plainToInstance(ExternalIdentifierListQueryDto, {
      organizationId: 'forged-org',
    });
    expect(
      await validate(unsupported, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).not.toEqual([]);
  });
});
