import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateLibraryDto, UpdateLibraryDto } from './library.dto.js';

describe('Library DTO ownership contract', () => {
  it('does not define client-supplied organization ownership', async () => {
    const dto = plainToInstance(CreateLibraryDto, {
      name: 'Central',
      organizationId: 'forged-organization',
    });

    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });

  it('rejects whitespace-only names', async () => {
    const dto = plainToInstance(CreateLibraryDto, { name: '   ' });
    expect(await validate(dto)).not.toEqual([]);
  });

  it('only allows name updates', async () => {
    const dto = plainToInstance(UpdateLibraryDto, {
      name: 'Updated',
      organizationId: 'forged',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });
});
