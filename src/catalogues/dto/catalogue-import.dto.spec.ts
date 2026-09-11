import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CatalogueImportBibliographicRecordDto,
  CatalogueImportDto,
  CatalogueContributionInputDto,
} from './catalogue-import.dto.js';

describe('CatalogueImportBibliographicRecordDto security', () => {
  it('strips client-supplied source/schema/sourceId provenance fields', async () => {
    const instance = plainToInstance(CatalogueImportBibliographicRecordDto, {
      format: 'MARCXCHANGE',
      remoteId: '3664836',
      rawContent: '<collection />',
      // Attempted forgery: none of these exist on the DTO any more.
      source: 'FORGED_SOURCE',
      schema: 'FORGED_SCHEMA',
      sourceId: 'forged-provider',
    });

    await validate(instance, { whitelist: true });

    expect(instance).not.toHaveProperty('source');
    expect(instance).not.toHaveProperty('schema');
    expect(instance).not.toHaveProperty('sourceId');
  });

  it('rejects a format outside the supported enum', async () => {
    const instance = plainToInstance(CatalogueImportBibliographicRecordDto, {
      format: 'INVENTED_FORMAT',
      rawContent: '<collection />',
    });

    const errors = await validate(instance);

    expect(errors).not.toEqual([]);
  });

  it('accepts a supported format with only rawContent required', async () => {
    const instance = plainToInstance(CatalogueImportBibliographicRecordDto, {
      format: 'MARC_TEXT',
      rawContent: '001 3664836',
    });

    const errors = await validate(instance);

    expect(errors).toEqual([]);
  });
});

describe('CatalogueContributionInputDto corporate source tags', () => {
  it('accepts corporate/meeting source tags 710-713', async () => {
    for (const sourceTag of ['710', '711', '712', '713'] as const) {
      const instance = plainToInstance(CatalogueContributionInputDto, {
        targetScope: 'WORK',
        kind: 'CORPORATE_BODY',
        displayName: 'Portugal. Ministério da Cultura',
        sourceTag,
        indicator1: ' ',
        indicator2: ' ',
        sortOrder: 0,
        sourceParts: [{ code: 'a', value: 'Portugal.', sortOrder: 0 }],
      });

      const errors = await validate(instance);
      expect(errors).toEqual([]);
    }
  });

  it('rejects an unsupported source tag', async () => {
    const instance = plainToInstance(CatalogueContributionInputDto, {
      targetScope: 'WORK',
      kind: 'CORPORATE_BODY',
      displayName: 'Example',
      sourceTag: '999',
      indicator1: ' ',
      indicator2: ' ',
      sortOrder: 0,
      sourceParts: [{ code: 'a', value: 'Example', sortOrder: 0 }],
    });

    const errors = await validate(instance);
    expect(errors).not.toEqual([]);
  });
});

describe('CatalogueImportDto client-editable Phase 1 fields', () => {
  const baseWork = { title: 'Work title' };
  const baseEdition = { title: 'Edition title' };
  const baseBibliographicRecord = {
    format: 'MARCXCHANGE',
    rawContent: '<collection />',
  };
  const baseItem = { status: 'OWNED' };

  it('accepts multiple titles, languages, series, notes and classifications', async () => {
    const instance = plainToInstance(CatalogueImportDto, {
      work: {
        ...baseWork,
        titles: [{ type: 'MAIN', value: 'Work title', sortOrder: 0 }],
      },
      edition: {
        ...baseEdition,
        titles: [
          { type: 'MAIN', value: 'Edition title', sortOrder: 0 },
          { type: 'PARALLEL', value: 'Parallel title', sortOrder: 1 },
        ],
        responsibilityStatements: [
          { label: 'STATEMENT', value: 'Pedro Braga', sortOrder: 0 },
        ],
        languages: [
          { code: 'por', role: 'TEXT', sortOrder: 0 },
          { code: 'eng', role: 'ORIGINAL_LANGUAGE', sortOrder: 1 },
        ],
        series: [{ title: 'Série', volumeNumber: '1', sortOrder: 0 }],
        notes: [{ type: 'SUMMARY', value: 'Resumo', sortOrder: 0 }],
        classifications: [
          { notation: '821.134.3', system: 'UDC', sortOrder: 0 },
        ],
      },
      contributors: [],
      externalIdentifiers: [],
      bibliographicRecord: baseBibliographicRecord,
      item: baseItem,
    });

    const errors = await validate(instance, { whitelist: true });
    expect(errors).toEqual([]);
  });

  it('rejects an invalid title type', async () => {
    const instance = plainToInstance(CatalogueImportDto, {
      work: baseWork,
      edition: {
        ...baseEdition,
        titles: [{ type: 'INVALID', value: 'x', sortOrder: 0 }],
      },
      contributors: [],
      externalIdentifiers: [],
      bibliographicRecord: baseBibliographicRecord,
      item: baseItem,
    });

    const errors = await validate(instance);
    expect(errors).not.toEqual([]);
  });
});
