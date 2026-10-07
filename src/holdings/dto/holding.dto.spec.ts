import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateHoldingDto, UpdateHoldingDto } from './holding.dto.js';

describe('Holding DTO ownership contract', () => {
  it('requires only Edition and Location parent IDs, not a competing organization', async () => {
    const dto = plainToInstance(CreateHoldingDto, {
      editionId: 'edition-a',
      locationId: 'location-a',
      organizationId: 'forged-org',
      libraryId: 'forged-library',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });

  it('does not allow parent ownership to change on update', async () => {
    const dto = plainToInstance(UpdateHoldingDto, {
      notes: 'New note',
      editionId: 'other-edition',
      locationId: 'other-location',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });
});
