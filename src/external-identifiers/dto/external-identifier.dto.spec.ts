import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateExternalIdentifierDto,
  ExternalIdentifierListQueryDto,
  UpdateExternalIdentifierDto,
} from './external-identifier.dto.js';

describe('External Identifier DTO ownership contract', () => {
  it('requires editionId on create and rejects tenant/alternate-parent authorities', async () => {
    const dto = plainToInstance(CreateExternalIdentifierDto, {
      type: 'ISBN-13',
      value: '9780000000001',
      editionId: 'edition-a',
      organizationId: 'forged-org',
      workId: 'forged-work',
      libraryId: 'forged-library',
      locationId: 'forged-location',
      holdingId: 'forged-holding',
    });

    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);

    const valid = plainToInstance(CreateExternalIdentifierDto, {
      type: 'ISBN-13',
      value: '9780000000001',
      editionId: 'edition-a',
    });
    expect(await validate(valid, { whitelist: true })).toEqual([]);
  });

  it('does not permit changing the Edition parent on update', async () => {
    const dto = plainToInstance(UpdateExternalIdentifierDto, {
      value: '9780000000002',
      editionId: 'edition-b',
    });

    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });

  it('allows editionId only as a root-list refinement, never tenant authority', async () => {
    const valid = plainToInstance(ExternalIdentifierListQueryDto, {
      editionId: 'edition-a',
      limit: '10',
    });
    expect(await validate(valid, { whitelist: true, transform: true })).toEqual(
      [],
    );
    expect(valid.limit).toBe(10);

    const forged = plainToInstance(ExternalIdentifierListQueryDto, {
      organizationId: 'forged-org',
    });
    expect(
      await validate(forged, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });
});
