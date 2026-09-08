import { describe, expect, it } from 'vitest';
import { validateMarcRecord } from '../marc-record.validation.js';
import {
  mapLocalEditionToUnimarc,
  PROVISIONAL_UNIMARC_LEADER,
  type UnimarcLocalEditionInput,
} from './unimarc-local.mapper.js';

const completeEdition: UnimarcLocalEditionInput = {
  id: 'edition-local-1',
  title: 'Título da edição',
  subtitle: 'Subtítulo da edição',
  isbn10: '0306406152',
  isbn13: '9780306406157',
  publisher: 'Editora Folio',
  publicationDate: '2024-01-02',
  language: 'por',
  pageCount: 320,
  work: { title: 'Título da obra' },
  editionContributors: [
    {
      role: 'author',
      sortOrder: 0,
      contributor: { name: 'Autor Principal' },
    },
    {
      role: 'author',
      sortOrder: 1,
      contributor: { name: 'Autor Secundário' },
    },
  ],
};

describe('local UNIMARC mapper', () => {
  it('maps a complete edition to a valid UNIMARC subset', () => {
    const result = mapLocalEditionToUnimarc(completeEdition);

    expect(result.record.leader).toBe(PROVISIONAL_UNIMARC_LEADER);
    expect(result.record.controlFields).toEqual([
      { tag: '001', value: 'edition-local-1' },
    ]);
    expect(result.record.dataFields).toEqual([
      {
        tag: '010',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: '0306406152' },
          { code: 'a', value: '9780306406157' },
        ],
      },
      {
        tag: '101',
        indicator1: '0',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'por' }],
      },
      {
        tag: '200',
        indicator1: '1',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'Título da edição' },
          { code: 'e', value: 'Subtítulo da edição' },
        ],
      },
      {
        tag: '210',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'c', value: 'Editora Folio' },
          { code: 'd', value: '2024-01-02' },
        ],
      },
      {
        tag: '215',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: '320 p.' }],
      },
      {
        tag: '700',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Autor Principal' }],
      },
      {
        tag: '701',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Autor Secundário' }],
      },
    ]);
    expect(result.warnings).toEqual([]);
    validateMarcRecord(result.record);
  });

  it('maps an edition with only the required local identifier', () => {
    const result = mapLocalEditionToUnimarc({ id: 'minimal-edition' });

    expect(result.record.controlFields).toEqual([
      { tag: '001', value: 'minimal-edition' },
    ]);
    expect(result.record.dataFields).toEqual([]);
    expect(result.warnings).toEqual([
      {
        field: '101$a',
        code: 'missing_required_data',
        message: 'Edition language is missing; 101$a was not generated.',
      },
      {
        field: '200$a',
        code: 'missing_required_data',
        message:
          'Neither the edition title nor Work.title is available; 200$a was not generated.',
      },
    ]);
    expect(() => validateMarcRecord(result.record)).not.toThrow();
  });

  it('uses Work.title only as the documented title fallback', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'fallback-edition',
      language: 'por',
      work: { title: 'Título da obra' },
    });

    expect(result.record.dataFields).toContainEqual({
      tag: '200',
      indicator1: '1',
      indicator2: ' ',
      subfields: [{ code: 'a', value: 'Título da obra' }],
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns when an edition has no title', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'untitled-edition',
      language: 'por',
    });

    expect(result.warnings).toContainEqual({
      field: '200$a',
      code: 'missing_required_data',
      message:
        'Neither the edition title nor Work.title is available; 200$a was not generated.',
    });
    expect(() => validateMarcRecord(result.record)).not.toThrow();
  });

  it('maps the first author to 700 and additional authors to 701', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'authors-edition',
      title: 'Título',
      language: 'por',
      editionContributors: [
        {
          role: 'author',
          sortOrder: 2,
          contributor: { name: 'Segundo na ordem' },
        },
        {
          role: 'author',
          sortOrder: 1,
          contributor: { name: 'Primeiro na ordem' },
        },
      ],
    });

    expect(result.record.dataFields.slice(-2)).toEqual([
      {
        tag: '700',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Primeiro na ordem' }],
      },
      {
        tag: '701',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Segundo na ordem' }],
      },
    ]);
  });

  it('warns instead of inventing a function code for an unmapped contributor role', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'translator-edition',
      title: 'Título',
      language: 'por',
      editionContributors: [
        {
          role: 'translator',
          sortOrder: 0,
          contributor: { name: 'Tradutor' },
        },
      ],
    });

    expect(result.record.dataFields.some(({ tag }) => tag === '702')).toBe(false);
    expect(result.warnings).toContainEqual({
      field: '702$a',
      code: 'unmapped_data',
      message:
        'Contributor role "translator" has no safe UNIMARC function mapping; 702$a was not generated.',
      sourceValue: 'Tradutor',
    });
  });

  it('warns for external identifiers because no external type is mapped yet', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'external-id-edition',
      title: 'Título',
      language: 'por',
      externalIdentifiers: [
        { type: 'BNP', value: '12345' },
        { type: 'OCLC', value: 'oclc-1' },
      ],
    });

    expect(result.warnings).toEqual([
      {
        field: 'externalIdentifier',
        code: 'unmapped_data',
        message:
          'External identifier type "BNP" is not mapped in the initial UNIMARC subset.',
        sourceValue: '12345',
      },
      {
        field: 'externalIdentifier',
        code: 'unmapped_data',
        message:
          'External identifier type "OCLC" is not mapped in the initial UNIMARC subset.',
        sourceValue: 'oclc-1',
      },
    ]);
  });

  it('does not emit 215 when pageCount is absent', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'no-pages-edition',
      title: 'Título',
      language: 'por',
    });

    expect(result.record.dataFields.some(({ tag }) => tag === '215')).toBe(false);
    expect(result.warnings).not.toContainEqual(
      expect.objectContaining({ field: '215$a' }),
    );
  });

  it('preserves ordered physical descriptions instead of synthesizing pages', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'physical-edition',
      title: 'Título',
      language: 'por',
      pageCount: 999,
      physicalDescriptions: [
        { sortOrder: 0, parts: [
          { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
          { subfield: 'b', value: 'il.', sortOrder: 1 },
        ] },
        { sortOrder: 1, parts: [
          { subfield: 'a', value: '24 cm', sortOrder: 0 },
          { subfield: 'd', value: 'volume', sortOrder: 1 },
        ] },
      ],
    });

    expect(result.record.dataFields).toContainEqual({
      tag: '215',
      indicator1: ' ',
      indicator2: ' ',
      subfields: [
        { code: 'a', value: '146, [6] p.' },
        { code: 'b', value: 'il.' },
      ],
    });
    expect(result.record.dataFields).toContainEqual(expect.objectContaining({
      tag: '215',
      subfields: [
        { code: 'a', value: '24 cm' },
        { code: 'd', value: 'volume' },
      ],
    }));
    expect(result.record.dataFields.filter(({ tag }) => tag === '215')).toHaveLength(2);
  });

  it('uses pageCount only as the fallback when descriptions are absent', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'legacy-pages-edition',
      title: 'Título',
      language: 'por',
      pageCount: 320,
    });

    expect(result.record.dataFields).toContainEqual(
      expect.objectContaining({
        tag: '215',
        subfields: [{ code: 'a', value: '320 p.' }],
      }),
    );
  });

  it('exports ordered publication statements and ignores scalar projections', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'publication-edition',
      title: 'Título',
      language: 'por',
      publisher: 'Wrong scalar publisher',
      publicationDate: '1999',
      publicationPlace: 'Wrong scalar place',
      publicationStatements: [
        {
          sortOrder: 1,
          indicator1: ' ',
          indicator2: '9',
          parts: [{ subfield: 'c', value: '[s.n.]', sortOrder: 0 }],
        },
        {
          sortOrder: 0,
          indicator1: '1',
          indicator2: '2',
          parts: [
            { subfield: 'a', value: '[S.l.]', sortOrder: 0 },
            { subfield: 'a', value: 'Lisboa', sortOrder: 1 },
            { subfield: 'd', value: 'D.L. 2009', sortOrder: 2 },
          ],
        },
      ],
    });

    expect(result.record.dataFields.filter(({ tag }) => tag === '210')).toEqual([
      { tag: '210', indicator1: '1', indicator2: '2', subfields: [
        { code: 'a', value: '[S.l.]' },
        { code: 'a', value: 'Lisboa' },
        { code: 'd', value: 'D.L. 2009' },
      ] },
      { tag: '210', indicator1: ' ', indicator2: '9', subfields: [
        { code: 'c', value: '[s.n.]' },
      ] },
    ]);
  });

  it('falls back to scalar publication projections when statements are absent', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'legacy-publication-edition', title: 'Título', language: 'por',
      publicationPlace: 'Coimbra', publisher: 'Editora', publicationDate: '2024',
    });
    expect(result.record.dataFields).toContainEqual({
      tag: '210', indicator1: ' ', indicator2: ' ',
      subfields: [
        { code: 'a', value: 'Coimbra' },
        { code: 'c', value: 'Editora' },
        { code: 'd', value: '2024' },
      ],
    });
  });

  it('does not use rawContent when mapping local data', () => {
    const localInput = {
      id: 'local-edition',
      title: 'Título corrigido localmente',
      language: 'por',
      rawContent: '<record><datafield tag="200"><subfield code="a">Título original</subfield></datafield></record>',
    } as UnimarcLocalEditionInput & { rawContent: string };

    const result = mapLocalEditionToUnimarc(localInput);

    expect(result.record.dataFields).toContainEqual({
      tag: '200',
      indicator1: '1',
      indicator2: ' ',
      subfields: [{ code: 'a', value: 'Título corrigido localmente' }],
    });
    expect(JSON.stringify(result.record)).not.toContain('Título original');
  });
});
