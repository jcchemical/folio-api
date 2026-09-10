import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SearchCatalogueDto } from './search-catalogue.dto.js';

async function validationMessages(input: unknown): Promise<string[]> {
  const dto = plainToInstance(SearchCatalogueDto, input);
  const errors = await validate(dto, { whitelist: true });
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...error.children.flatMap((child) =>
      Object.values(child.constraints ?? {}),
    ),
  ]);
}

describe('SearchCatalogueDto', () => {
  it('accepts an ISBN query with an optional source id', async () => {
    await expect(
      validationMessages({
        sourceId: 'porbase',
        query: { type: 'isbn', isbn: '9789724426495' },
      }),
    ).resolves.toEqual([]);
  });

  it('rejects an implicit ISBN query without a type', async () => {
    await expect(
      validationMessages({ query: { isbn: '9789724426495' } }),
    ).resolves.not.toEqual([]);
  });

  it('rejects an unknown search type', async () => {
    await expect(
      validationMessages({
        query: { type: 'identifier', isbn: '9789724426495' },
      }),
    ).resolves.not.toEqual([]);
  });

  it('requires the field selected by the type', async () => {
    await expect(
      validationMessages({ query: { type: 'isbn' } }),
    ).resolves.not.toEqual([]);
    await expect(
      validationMessages({ query: { type: 'title' } }),
    ).resolves.not.toEqual([]);
  });

  it('rejects fields that do not match the selected type', async () => {
    await expect(
      validationMessages({
        query: { type: 'isbn', isbn: '9789724426495', title: 'Zorbás' },
      }),
    ).resolves.not.toEqual([]);
    await expect(
      validationMessages({ query: { type: 'isbn', title: 'Zorbás' } }),
    ).resolves.not.toEqual([]);
  });
});
