import { describe, expect, it } from 'vitest';
import { validateMarcRecord } from '../marc-record.validation.js';
import { canonicalEditionFixture } from './fixtures/canonical-edition.js';
import {
  mapLocalEditionToUnimarc,
  PROVISIONAL_UNIMARC_LEADER,
  type UnimarcLocalEditionInput,
} from './unimarc-local.mapper.js';

describe('canonical local UNIMARC mapper', () => {
  it('maps canonical Phase 1 concepts with exact tags, indicators, values, order, and repetition', () => {
    const result = mapLocalEditionToUnimarc(canonicalEditionFixture);

    expect(result.record.leader).toBe(PROVISIONAL_UNIMARC_LEADER);
    expect(result.record.controlFields).toEqual([
      { tag: '001', value: 'edition-canonical-1' },
    ]);
    expect(result.record.dataFields).toEqual([
      {
        tag: '010',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: '9789724426495' }],
      },
      {
        tag: '101',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'por' },
          { code: 'a', value: 'eng' },
          { code: 'c', value: 'fra' },
          { code: 'j', value: 'spa' },
        ],
      },
      {
        tag: '200',
        indicator1: '1',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'Título da edição' },
          { code: 'd', value: 'Edition title' },
          { code: 'e', value: 'Subtítulo canónico' },
          { code: 'f', value: 'por Ana Silva' },
          { code: 'f', value: 'e Rui Costa' },
          { code: 'g', value: 'tradução de Lee' },
        ],
      },
      {
        tag: '205',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: '2.ª edição' },
          { code: 'b', value: 'revista' },
          { code: 'f', value: 'por Ana Silva' },
        ],
      },
      {
        tag: '210',
        indicator1: ' ',
        indicator2: '9',
        subfields: [
          { code: 'a', value: 'Lisboa' },
          { code: 'c', value: 'Editora Canónica' },
          { code: 'd', value: '2024' },
        ],
      },
      {
        tag: '210',
        indicator1: ' ',
        indicator2: '9',
        subfields: [
          { code: 'e', value: 'Porto' },
          { code: 'f', value: 'Distribuidora' },
        ],
      },
      {
        tag: '215',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: '146, [6] p.' },
          { code: 'b', value: 'il.' },
          { code: 'd', value: '24 cm' },
        ],
      },
      {
        tag: '225',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'Colecção Folio' },
          { code: 'e', value: 'Folio series' },
          { code: 'v', value: '12' },
          { code: 'x', value: '1234-5679' },
        ],
      },
      {
        tag: '300',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Nota geral' }],
      },
      {
        tag: '300',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Nota da obra' }],
      },
      {
        tag: '320',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Contém bibliografia' }],
      },
      {
        tag: '327',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Conteúdo em texto livre' }],
      },
      {
        tag: '328',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Dissertação' }],
      },
      {
        tag: '330',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Resumo' }],
      },
      {
        tag: '517',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Título alternativo' }],
      },
      {
        tag: '675',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: '821.134.3' },
          { code: 'v', value: '2019' },
          { code: '3', value: 'authority-udc' },
        ],
      },
      {
        tag: '676',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: '869.3' }],
      },
      {
        tag: '680',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'PQ9261' }],
      },
      {
        tag: '686',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'LOCAL-7' }],
      },
      {
        tag: '700',
        indicator1: '1',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'Silva, Ana' },
          { code: '4', value: '070' },
        ],
      },
      {
        tag: '710',
        indicator1: '2',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'Associação Folio' },
          { code: '4', value: '070' },
          { code: '4', value: '570' },
        ],
      },
      {
        tag: '713',
        indicator1: '2',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Fundação Exemplo' }],
      },
    ]);
    expect(
      result.warnings.every(
        ({ source, target, severity, lossy }) =>
          Boolean(source) &&
          severity === 'warning' &&
          typeof lossy === 'boolean' &&
          target !== undefined,
      ),
    ).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'EditionLanguage.role:PARALLEL_TEXT',
          target: '101$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'EditionLanguage.role:SUBTITLES',
          target: '101$j',
          lossy: false,
        }),
        expect.objectContaining({
          source: 'EditionLanguage.translationIndicator',
          target: '101.ind1',
        }),
        expect.objectContaining({
          source: 'PublicationStatementPart.groupIndex',
          target: '210',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'Series.parallelTitle',
          target: '225$e',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'EditionTitle.type:OTHER',
          target: null,
          lossy: true,
        }),
        expect.objectContaining({
          source: 'Edition BibliographicNote.PROVENANCE',
          target: null,
        }),
        expect.objectContaining({
          source: 'Edition BibliographicNote.OTHER',
          target: null,
        }),
        expect.objectContaining({
          source: 'Classification.systemEdition',
          target: '675$v',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'ExternalIdentifier.PORBASE',
          target: null,
          lossy: true,
        }),
        expect.objectContaining({
          source: 'legacyProjection.edition.ISBN-10',
          target: '010$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'Work.BibliographicNote',
          target: '300$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'Work.Contribution',
          target: '713',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'WorkTitle.type:VARIANT',
          target: '517$a',
          lossy: true,
        }),
      ]),
    );
    validateMarcRecord(result.record);
  });

  it('uses canonical values over populated legacy projections without mixing concepts', () => {
    const result = mapLocalEditionToUnimarc(canonicalEditionFixture);
    const flattened = JSON.stringify(result.record);

    expect(flattened).toContain('Título da edição');
    expect(flattened).not.toContain('Título escalar obsoleto');
    expect(flattened).not.toContain('Subtítulo escalar obsoleto');
    expect(flattened).not.toContain('Editora escalar');
    expect(flattened).not.toContain('Lugar escalar');
    expect(flattened).not.toContain('9780000000000');
    expect(flattened).not.toContain('0306406152');
    expect(flattened).not.toContain('999 p.');
  });

  it('uses Work MAIN when Edition MAIN is absent and maps OTHER only through its subtitle', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'work-main-fallback',
      titles: [
        {
          type: 'OTHER',
          value: 'Other title',
          subtitle: 'Other title information',
          sortOrder: 0,
        },
      ],
      languages: [],
      work: {
        titles: [
          { type: 'MAIN', value: 'Work canonical main title', sortOrder: 0 },
        ],
        notes: [],
        contributions: [],
      },
      legacyProjection: {
        edition: { title: 'Legacy title that must not win' },
        work: { title: 'Legacy work title' },
      },
    });
    const title = result.record.dataFields.find(({ tag }) => tag === '200');

    expect(title).toEqual({
      tag: '200',
      indicator1: '1',
      indicator2: ' ',
      subfields: [
        { code: 'a', value: 'Work canonical main title' },
        { code: 'e', value: 'Other title information' },
      ],
    });
    expect(result.record.dataFields.some(({ tag }) => tag === '517')).toBe(
      false,
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        source: 'WorkTitle.type:MAIN',
        target: '200$a',
        lossy: true,
      }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        source: 'EditionTitle.type:OTHER',
        target: null,
        lossy: true,
      }),
    );
  });

  it('uses legacy projections only when the corresponding canonical relation is empty', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'legacy-edition',
      titles: [],
      languages: [],
      publicationStatements: [],
      physicalDescriptions: [],
      externalIdentifiers: [],
      contributions: [],
      editionStatements: [],
      series: [],
      notes: [],
      classifications: [],
      work: { titles: [], notes: [], contributions: [] },
      legacyProjection: {
        edition: {
          title: 'Legacy title',
          subtitle: 'Legacy subtitle',
          isbn10: '0306406152',
          isbn13: null,
          publisher: 'Legacy publisher',
          publicationDate: '2001',
          publicationPlace: 'Coimbra',
          language: 'por',
          pageCount: 100,
        },
        work: { title: 'Legacy work title' },
      },
      editionContributors: [
        {
          role: 'author',
          sortOrder: 0,
          contributor: { name: 'Legacy author' },
        },
      ],
      workContributors: [],
    });

    expect(result.record.dataFields).toEqual([
      {
        tag: '010',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: '0306406152' }],
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
          { code: 'a', value: 'Legacy title' },
          { code: 'e', value: 'Legacy subtitle' },
        ],
      },
      {
        tag: '210',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [
          { code: 'a', value: 'Coimbra' },
          { code: 'c', value: 'Legacy publisher' },
          { code: 'd', value: '2001' },
        ],
      },
      {
        tag: '215',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: '100 p.' }],
      },
      {
        tag: '700',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Legacy author' }],
      },
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'legacyProjection.edition.isbn',
          target: '010$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'legacyProjection.edition.language',
          target: '101$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'legacyProjection.edition.title',
          target: '200$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'legacyProjection.edition.publication',
          target: '210',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'legacyProjection.edition.pageCount',
          target: '215$a',
          lossy: true,
        }),
        expect.objectContaining({
          source: 'Edition legacy contributor',
          target: '700$a',
          lossy: true,
        }),
      ]),
    );
  });

  it('uses canonical contributions per target and falls back only for the target without them', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'target-fallback',
      titles: [{ type: 'MAIN', value: 'Title', sortOrder: 0 }],
      languages: [{ code: 'por', role: 'TEXT', sortOrder: 0 }],
      contributions: [
        {
          sortOrder: 0,
          sourceTag: '702',
          indicator1: '1',
          indicator2: ' ',
          sourceParts: [
            { code: 'a', value: 'Canonical edition contributor', sortOrder: 0 },
          ],
        },
      ],
      work: { contributions: [], titles: [], notes: [] },
      editionContributors: [
        {
          role: 'author',
          sortOrder: 0,
          contributor: { name: 'Ignored edition legacy' },
        },
      ],
      workContributors: [
        {
          role: 'author',
          sortOrder: 0,
          contributor: { name: 'Fallback work legacy' },
        },
      ],
    });

    expect(
      result.record.dataFields.filter(({ tag }) => tag.startsWith('70')),
    ).toEqual([
      {
        tag: '700',
        indicator1: ' ',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Fallback work legacy' }],
      },
      {
        tag: '702',
        indicator1: '1',
        indicator2: ' ',
        subfields: [{ code: 'a', value: 'Canonical edition contributor' }],
      },
    ]);
    expect(
      result.record.dataFields.some(({ subfields }) =>
        subfields.some(({ value }) => value === 'Ignored edition legacy'),
      ),
    ).toBe(false);
  });

  it('preserves canonical corporate contribution tags 710 through 713 without name-based inference', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'corporate',
      titles: [],
      languages: [],
      contributions: ['710', '711', '712', '713'].map(
        (sourceTag, sortOrder) => ({
          sortOrder,
          sourceTag,
          indicator1: '2',
          indicator2: ' ',
          sourceParts: [
            { code: 'a', value: `Literal ${sourceTag}`, sortOrder: 0 },
          ],
        }),
      ),
      work: { titles: [], notes: [], contributions: [] },
    });

    expect(
      result.record.dataFields
        .filter(({ tag }) => /^71[0-3]$/.test(tag))
        .map(({ tag, subfields }) => [tag, subfields[0].value]),
    ).toEqual([
      ['710', 'Literal 710'],
      ['711', 'Literal 711'],
      ['712', 'Literal 712'],
      ['713', 'Literal 713'],
    ]);
  });

  it('warns and omits duplicate ISBNs and unsupported identifier types without scalar duplication', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'identifiers',
      externalIdentifiers: [
        { type: 'ISBN-13', value: '9780000000000' },
        { type: 'ISBN-13', value: '9780000000000' },
        { type: 'BNP', value: 'bn-1' },
        { type: 'OCLC', value: 'oclc-1' },
        { type: 'PORBASE', value: 'pb-1' },
      ],
      legacyProjection: { edition: { isbn13: '9780000000000' } },
    });

    expect(result.record.dataFields.filter(({ tag }) => tag === '010')).toEqual(
      [
        {
          tag: '010',
          indicator1: ' ',
          indicator2: ' ',
          subfields: [{ code: 'a', value: '9780000000000' }],
        },
      ],
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'ExternalIdentifier.ISBN-13',
          target: '010$a',
          code: 'lossy_mapping',
        }),
        expect.objectContaining({
          source: 'ExternalIdentifier.BNP',
          target: null,
          lossy: true,
        }),
        expect.objectContaining({
          source: 'ExternalIdentifier.OCLC',
          target: null,
          lossy: true,
        }),
        expect.objectContaining({
          source: 'ExternalIdentifier.PORBASE',
          target: null,
          lossy: true,
        }),
      ]),
    );
  });

  it('warns on unknown edition statement kinds, source tags, classification systems, and incomplete contributions', () => {
    const result = mapLocalEditionToUnimarc({
      id: 'unsupported',
      editionStatements: [
        {
          value: 'unknown kind',
          kind: 'MYSTERY',
          sourceTag: '205',
          sortOrder: 0,
        },
        { value: 'wrong tag', kind: 'EDITION', sourceTag: '999', sortOrder: 1 },
      ],
      classifications: [{ notation: 'X', system: 'MYSTERY', sortOrder: 0 }],
      contributions: [
        {
          sortOrder: 0,
          sourceTag: '714',
          indicator1: ' ',
          indicator2: ' ',
          sourceParts: [{ code: 'a', value: 'Unsupported', sortOrder: 0 }],
        },
        {
          sortOrder: 1,
          sourceTag: '710',
          indicator1: null,
          indicator2: ' ',
          sourceParts: [{ code: 'a', value: 'Incomplete', sortOrder: 0 }],
        },
        {
          sortOrder: 2,
          sourceTag: '711',
          indicator1: '2',
          indicator2: ' ',
          sourceParts: [{ code: 'a', value: '', sortOrder: 0 }],
        },
      ],
      work: { titles: [], notes: [], contributions: [] },
    });

    expect(
      result.record.dataFields.some(({ tag }) =>
        ['205', '686', '714', '710', '711'].includes(tag),
      ),
    ).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'EditionStatement.kind:MYSTERY',
          target: '205',
        }),
        expect.objectContaining({
          source: 'EditionStatement.sourceTag:999',
          target: null,
        }),
        expect.objectContaining({
          source: 'Classification.system:MYSTERY',
          target: null,
        }),
        expect.objectContaining({
          source: 'Edition Contribution.714',
          target: '714',
        }),
        expect.objectContaining({
          source: 'Edition Contribution.710',
          target: '710',
        }),
        expect.objectContaining({
          source: 'Edition Contribution.711',
          target: '711',
        }),
      ]),
    );
  });

  it('does not use rawContent or unmappedSourceFields to reconstruct an export', () => {
    const input = {
      id: 'persisted-only',
      titles: [{ type: 'MAIN', value: 'Persisted title', sortOrder: 0 }],
      languages: [{ code: 'por', role: 'TEXT', sortOrder: 0 }],
      rawContent:
        '<record><datafield tag="200"><subfield code="a">Provider title</subfield></datafield></record>',
      unmappedSourceFields: [
        { tag: '999', subfields: [{ code: 'a', value: 'Do not copy' }] },
      ],
    } as UnimarcLocalEditionInput & {
      rawContent: string;
      unmappedSourceFields: unknown[];
    };
    const result = mapLocalEditionToUnimarc(input);
    const exported = JSON.stringify(result.record);

    expect(exported).toContain('Persisted title');
    expect(exported).not.toContain('Provider title');
    expect(exported).not.toContain('Do not copy');
    expect(exported).not.toContain('rawContent');
  });
});
