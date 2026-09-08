import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  derivePublicationProjection,
  PublicationStatementDto,
} from './publication-statement.dto.js';

function properties(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    error.property,
    ...properties(error.children ?? []),
  ]);
}

describe('PublicationStatementDto write validation', () => {
  it('rejects client-controlled source and normalizedValue fields', async () => {
    const statement = plainToInstance(PublicationStatementDto, {
      sortOrder: 0,
      source: 'CLIENT_SOURCE',
      parts: [{
        subfield: 'd',
        value: 'D.L. 2009',
        normalizedValue: '2009',
        sortOrder: 0,
      }],
    });

    const errors = await validate(statement, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(properties(errors)).toEqual(expect.arrayContaining([
      'source',
      'normalizedValue',
    ]));
  });

  it('compares scalar publication dates with the effective normalized value', () => {
    const projection = derivePublicationProjection({
      statements: [{
        sortOrder: 0,
        parts: [{ subfield: 'd', value: 'D.L. 2009', sortOrder: 0 }],
      }],
      publicationDate: '2009',
    });

    expect(projection.publicationDate).toBe('2009');
    expect(projection.warnings).not.toContainEqual(
      expect.objectContaining({ code: 'PUBLICATION_SCALAR_DIVERGENCE', field: 'edition.publicationDate' }),
    );
  });
});
