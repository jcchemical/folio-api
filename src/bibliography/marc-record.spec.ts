import { describe, expect, it } from 'vitest';
import { validateMarcRecord } from './marc-record.validation.js';
import type {
  BibliographicExportWarning,
  MarcRecord,
} from './marc-record.types.js';

const validRecord: MarcRecord = {
  leader: '00000nam a2200000 a 4500',
  controlFields: [
    { tag: '001', value: 'record-1' },
    { tag: '003', value: 'PT-BN' },
  ],
  dataFields: [
    {
      tag: '200',
      indicator1: '1',
      indicator2: ' ',
      subfields: [
        { code: 'a', value: 'Título principal' },
        { code: 'f', value: 'Autor' },
      ],
    },
  ],
};

describe('MARC record validation', () => {
  it('accepts a valid record', () => {
    expect(() => validateMarcRecord(validRecord)).not.toThrow();
  });

  it('rejects a leader with an invalid length', () => {
    expect(() =>
      validateMarcRecord({ ...validRecord, leader: 'short-leader' }),
    ).toThrow('MARC leader must contain exactly 24 characters');
  });

  it('rejects an invalid tag', () => {
    const record: MarcRecord = {
      ...validRecord,
      controlFields: [{ tag: '20A', value: 'value' }],
    };

    expect(() => validateMarcRecord(record)).toThrow(
      'controlFields[0].tag must contain exactly three digits',
    );
  });

  it('rejects an invalid indicator', () => {
    const record: MarcRecord = {
      ...validRecord,
      dataFields: [{ ...validRecord.dataFields[0], indicator1: '12' }],
    };

    expect(() => validateMarcRecord(record)).toThrow(
      'dataFields[0].indicator1 must contain exactly one character',
    );
  });

  it('rejects an invalid subfield code', () => {
    const record: MarcRecord = {
      ...validRecord,
      dataFields: [
        {
          ...validRecord.dataFields[0],
          subfields: [{ code: 'title', value: 'Título principal' }],
        },
      ],
    };

    expect(() => validateMarcRecord(record)).toThrow(
      'dataFields[0].subfields[0].code must contain exactly one character',
    );
  });

  it('preserves field and subfield order', () => {
    const record: MarcRecord = {
      ...validRecord,
      controlFields: [
        { tag: '003', value: 'source' },
        { tag: '001', value: 'identifier' },
      ],
      dataFields: [
        {
          tag: '210',
          indicator1: ' ',
          indicator2: '0',
          subfields: [
            { code: 'c', value: 'Publisher' },
            { code: 'a', value: 'Place' },
          ],
        },
        validRecord.dataFields[0],
      ],
    };
    const beforeValidation = structuredClone(record);

    validateMarcRecord(record);

    expect(record).toEqual(beforeValidation);
    expect(record.controlFields.map(({ tag }) => tag)).toEqual(['003', '001']);
    expect(record.dataFields.map(({ tag }) => tag)).toEqual(['210', '200']);
    expect(record.dataFields[0].subfields.map(({ code }) => code)).toEqual([
      'c',
      'a',
    ]);
  });

  it('accepts a space as a valid indicator', () => {
    const record: MarcRecord = {
      ...validRecord,
      dataFields: [
        {
          ...validRecord.dataFields[0],
          indicator1: ' ',
          indicator2: ' ',
        },
      ],
    };

    expect(() => validateMarcRecord(record)).not.toThrow();
  });

  it('allows typed warnings to coexist with a valid record', () => {
    const result: { record: MarcRecord; warnings: BibliographicExportWarning[] } = {
      record: validRecord,
      warnings: [
        {
          field: '210$d',
          code: 'normalization',
          message: 'Publication date was normalized.',
          sourceValue: '2009.',
        },
      ],
    };

    expect(() => validateMarcRecord(result.record)).not.toThrow();
    expect(result.warnings[0].code).toBe('normalization');
    expect(result.warnings[0].sourceValue).toBe('2009.');
  });
});
