import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateLocationDto, UpdateLocationDto } from './location.dto.js';

describe('Location DTO ownership contract', () => {
  it('requires libraryId only for child creation and rejects tenant overrides', async () => {
    const dto = plainToInstance(CreateLocationDto, {
      libraryId: 'library-a',
      name: 'Stacks',
      organizationId: 'forged-org',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });

  it('does not permit moving a Location to a different Library during update', async () => {
    const dto = plainToInstance(UpdateLocationDto, {
      name: 'New name',
      libraryId: 'other-library',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });
});
