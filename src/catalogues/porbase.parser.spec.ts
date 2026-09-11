import { describe, expect, it } from 'vitest';
import { parsePorbaseResponse } from './porbase.parser.js';

const query = '9789898236005';

function marcxchangeWithPublicationDate(publicationDate: string): string {
  return `<collection><record format="Unimarc"><datafield tag="210"><subfield code="d">${publicationDate}</subfield></datafield></record></collection>`;
}

describe('parsePorbaseResponse publication-date normalization', () => {
  it("normalizes 'D.L. 2009' and records a structured warning", () => {
    const rawContent = marcxchangeWithPublicationDate('D.L. 2009');

    const result = parsePorbaseResponse(query, rawContent, 'text/xml');

    expect(result.metadata.publicationDate).toBe('2009');
    expect(result.warnings).toContainEqual({
      code: 'PORBASE_NORMALIZATION',
      field: 'edition.publicationDate',
      message: "Data normalizada de 'D.L. 2009' para '2009'",
      original: 'D.L. 2009',
      normalized: '2009',
      type: 'normalization',
    });
    expect(result.rawContent).toBe(rawContent);
  });

  it("keeps '2009' without a normalization warning", () => {
    const result = parsePorbaseResponse(
      query,
      marcxchangeWithPublicationDate('2009'),
      'text/xml',
    );

    expect(result.metadata.publicationDate).toBe('2009');
    expect(result.warnings).toEqual([]);
  });

  it("reports a parse error for 's.d.'", () => {
    const result = parsePorbaseResponse(
      query,
      marcxchangeWithPublicationDate('s.d.'),
      'text/xml',
    );

    expect(result.metadata.publicationDate).toBeNull();
    expect(result.warnings).toContainEqual({
      code: 'PORBASE_PARSE_ERROR',
      field: 'edition.publicationDate',
      message: "Não foi possível extrair data de 's.d.'",
      original: 's.d.',
      type: 'parse_error',
    });
  });
});

describe('parsePorbaseResponse physical descriptions', () => {
  it('preserves repeated 215 subfields and source order from MARC text', () => {
    const result = parsePorbaseResponse(
      query,
      ['215 $a 146, [6] p. $b il.', '215 $a 24 cm $d volume'].join('\n'),
      'text/plain',
    );

    expect(result.metadata.extent).toBe('146, [6] p.');
    expect(result.metadata.physicalDescriptions).toEqual([
      {
        sortOrder: 0,
        source: 'PORBASE',
        parts: [
          { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
          { subfield: 'b', value: 'il.', sortOrder: 1 },
        ],
      },
      {
        sortOrder: 1,
        source: 'PORBASE',
        parts: [
          { subfield: 'a', value: '24 cm', sortOrder: 0 },
          { subfield: 'd', value: 'volume', sortOrder: 1 },
        ],
      },
    ]);
  });

  it('preserves repeated 215 fields and subfields from MARCXchange XML', () => {
    const result = parsePorbaseResponse(
      query,
      '<collection><record><datafield tag="215"><subfield code="a">146, [6] p.</subfield><subfield code="b">il.</subfield></datafield><datafield tag="215"><subfield code="c">24 cm</subfield><subfield code="d">volume</subfield></datafield></record></collection>',
      'text/xml',
    );

    expect(result.metadata.extent).toBe('146, [6] p.');
    expect(result.metadata.physicalDescriptions).toEqual([
      {
        sortOrder: 0,
        source: 'PORBASE',
        parts: [
          { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
          { subfield: 'b', value: 'il.', sortOrder: 1 },
        ],
      },
      {
        sortOrder: 1,
        source: 'PORBASE',
        parts: [
          { subfield: 'c', value: '24 cm', sortOrder: 0 },
          { subfield: 'd', value: 'volume', sortOrder: 1 },
        ],
      },
    ]);
  });
});

describe('parsePorbaseResponse publication statements', () => {
  it('preserves repeated 210 occurrences, parts, indicators and literal dates', () => {
    const result = parsePorbaseResponse(
      query,
      '<collection><record><datafield tag="210" ind1="1" ind2="2"><subfield code="a">[S.l.]</subfield><subfield code="a">Lisboa</subfield><subfield code="d">D.L. 2009</subfield></datafield><datafield tag="210"><subfield code="c">[s.n.]</subfield><subfield code="b">Distribuição</subfield></datafield></record></collection>',
      'text/xml',
    );

    expect(result.metadata.publicationStatements).toEqual([
      expect.objectContaining({
        sortOrder: 0,
        indicator1: '1',
        indicator2: '2',
        parts: [
          {
            subfield: 'a',
            value: '[S.l.]',
            sortOrder: 0,
            groupIndex: 0,
            normalizedValue: null,
          },
          {
            subfield: 'a',
            value: 'Lisboa',
            sortOrder: 1,
            groupIndex: 0,
            normalizedValue: null,
          },
          {
            subfield: 'd',
            value: 'D.L. 2009',
            sortOrder: 2,
            groupIndex: 0,
            normalizedValue: '2009',
          },
        ],
      }),
      expect.objectContaining({
        sortOrder: 1,
        indicator1: ' ',
        indicator2: '9',
      }),
    ]);
  });
  it('normalizes empty and absent XML indicators while preserving supplied values', () => {
    const result = parsePorbaseResponse(
      query,
      '<collection><record><datafield tag="210" ind1="" ind2="9"><subfield code="a">Lisboa</subfield></datafield><datafield tag="210" ind1="1" ind2="2"><subfield code="c">Editora</subfield></datafield></record></collection>',
      'text/xml',
    );

    expect(result.metadata.publicationStatements).toEqual([
      expect.objectContaining({ indicator1: ' ', indicator2: '9' }),
      expect.objectContaining({ indicator1: '1', indicator2: '2' }),
    ]);
  });
});

describe('parsePorbaseResponse canonical contributions', () => {
  it('preserves supported 7XX structure, repetitions and work scope', () => {
    const result = parsePorbaseResponse(
      query,
      [
        '700 $a Doe $b Jane $c Dr. $4 aut $4 999 $2 relator $x unknown',
        '701 $a Roe $b Richard',
        '702 $a Smith $b Sam $4 730 $o id $r qualifier $5 local $6 link $8 control',
        '710 $a Ignored corporate body',
      ].join('\n'),
      'text/plain',
    );

    expect(result.metadata.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTag: '700',
          targetScope: 'WORK',
          kind: 'PERSON',
          displayName: 'Doe, Jane',
          relationshipCodeScheme: 'relator',
          roleLabel: 'author',
        }),
        expect.objectContaining({
          sourceTag: '701',
          displayName: 'Roe, Richard',
          roleLabel: 'author',
        }),
        expect.objectContaining({
          sourceTag: '702',
          displayName: 'Smith, Sam',
          roleLabel: 'translator',
        }),
      ]),
    );
    expect(
      result.metadata.contributions?.[0].sourceParts.map(({ code, value }) => [
        code,
        value,
      ]),
    ).toEqual([
      ['a', 'Doe'],
      ['b', 'Jane'],
      ['c', 'Dr.'],
      ['4', 'aut'],
      ['4', '999'],
      ['2', 'relator'],
      ['x', 'unknown'],
    ]);
    expect(
      result.metadata.contributions?.[2].sourceParts.map(({ code }) => code),
    ).toEqual(['a', 'b', '4', 'o', 'r', '5', '6', '8']);
    expect(result.metadata.contributions?.[3]).toMatchObject({
      sourceTag: '710',
      kind: 'CORPORATE_BODY',
      displayName: 'Ignored corporate body',
    });
  });

  it('preserves unknown relationship codes without inventing a role label', () => {
    const result = parsePorbaseResponse(
      query,
      '702 $a Doe $b Jane $4 xyz',
      'text/plain',
    );
    expect(result.metadata.contributions?.[0]).toMatchObject({
      sourceTag: '702',
      roleLabel: undefined,
    });
    expect(result.metadata.contributions?.[0].sourceParts).toContainEqual(
      expect.objectContaining({ code: '4', value: 'xyz' }),
    );
  });

  it('derives a personal display name from $a alone without qualifiers', () => {
    const result = parsePorbaseResponse(
      query,
      '700 $a Pessoa $c Dr. $f 1900-2000',
      'text/plain',
    );
    expect(result.metadata.contributions?.[0]).toMatchObject({
      displayName: 'Pessoa',
    });
    expect(
      result.metadata.contributions?.[0].sourceParts.map(({ code }) => code),
    ).toEqual(['a', 'c', 'f']);
  });
  it('normalizes empty and absent XML indicators while preserving supplied values', () => {
    const result = parsePorbaseResponse(
      query,
      '<collection><record><datafield tag="700" ind1="" ind2="1"><subfield code="a">Doe</subfield></datafield><datafield tag="702"><subfield code="a">Roe</subfield><subfield code="4">273</subfield></datafield><datafield tag="702" ind1="1" ind2="2"><subfield code="a">Smith</subfield></datafield></record></collection>',
      'text/xml',
    );

    expect(result.metadata.contributions).toEqual([
      expect.objectContaining({
        sourceTag: '700',
        indicator1: ' ',
        indicator2: '1',
      }),
      expect.objectContaining({
        sourceTag: '702',
        indicator1: ' ',
        indicator2: ' ',
      }),
      expect.objectContaining({
        sourceTag: '702',
        indicator1: '1',
        indicator2: '2',
      }),
    ]);
  });
});

describe('parsePorbaseResponse Phase 1 enrichment', () => {
  const enrichedCorpusExtract = [
    '001 1924216',
    '003 http://id.bnportugal.gov.pt/bib/catbnp/1924216',
    '101 $a por $a eng $c fre',
    '102 $a PT',
    '200 $a O velho do Restelo $b Manuscrito] $d The old man of Restelo $e uma biografia imaginária $f Pedro Braga $g coord. Helena Silva $h Vol. 1 $i Parte histórica $x subcampo desconhecido',
    '205 $a 1ª ed $b reimp',
    '210 $a São Paulo $a Lisboa $c Chiado Editora $e Porto $g Impressora Exemplo $d 2015',
    '210 $a Coimbra $c Outro editor $d 2016',
    '215 $a 119 p. $c il. $d 22 cm $e enc.',
    '215 $a 2 v. $d 25 cm',
    '225 $a Viagens na ficção $v 1 $x 0873-7627 $e Voyages in fiction',
    '500 $a O velho do Restelo',
    '517 $a O velho do Restelo, uma biografia imaginária',
    '300 $a Nota geral',
    '317 $a Biblioteca Jorge de Sena',
    '320 $a Bibliografia, p. 10-20',
    '327 $a Contém índice',
    '328 $a Dissertação de mestrado',
    '330 $a Resumo da obra',
    '675 $a 821.134.3-3 $v BN $z por $3 12345',
    '676 $a 869.0 $v 23 $3 67890',
    '710 $a Portugal. Ministério da Cultura $3 777',
    '900 $a BIBNAC $d 2017',
    '966 $l BN $s CT. 123 V.',
    '972 $a campo local',
    '200 $a Segundo título $z subcampo futuro',
  ].join('\n');

  it('supports a real corpus-shaped record without ISBN', () => {
    const result = parsePorbaseResponse(
      'record:1924216',
      enrichedCorpusExtract,
      'text/plain',
    );

    expect(result.metadata.isbn).toBeUndefined();
    expect(
      result.metadata.titles.map(({ type, value }) => [type, value]),
    ).toEqual([
      ['MAIN', 'O velho do Restelo'],
      ['PARALLEL', 'The old man of Restelo'],
      ['OTHER', 'uma biografia imaginária'],
      ['OTHER', 'Vol. 1'],
      ['OTHER', 'Parte histórica'],
      ['VARIANT', 'O velho do Restelo'],
      ['VARIANT', 'O velho do Restelo, uma biografia imaginária'],
      ['MAIN', 'Segundo título'],
    ]);
  });

  it('preserves responsibilities, languages, edition statements and resource designation', () => {
    const result = parsePorbaseResponse(
      'record:1924216',
      enrichedCorpusExtract,
      'text/plain',
    );

    expect(
      result.metadata.responsibilityStatements.map(({ value }) => value),
    ).toEqual(['Pedro Braga', 'coord. Helena Silva']);
    expect(result.metadata.languages).toEqual([
      { code: 'por', role: 'TEXT', sortOrder: 0 },
      { code: 'eng', role: 'TEXT', sortOrder: 1 },
      {
        code: 'fre',
        role: 'ORIGINAL_LANGUAGE',
        sortOrder: 2,
        sourceCode: '101$c',
      },
    ]);
    expect(result.metadata.editionStatements).toEqual([
      {
        value: '1ª ed',
        kind: 'EDITION',
        label: null,
        sortOrder: 0,
        sourceTag: '205',
      },
      {
        value: 'reimp',
        kind: 'OTHER',
        label: null,
        sortOrder: 1,
        sourceTag: '205',
      },
    ]);
    expect(result.metadata.generalMaterialDesignation).toBe('Manuscrito]');
    expect(result.metadata.resourceType).toBe('UNSPECIFIED');
  });

  it('preserves repeated publication and physical descriptions in source order', () => {
    const result = parsePorbaseResponse(
      'record:1924216',
      enrichedCorpusExtract,
      'text/plain',
    );

    expect(result.metadata.publicationStatements).toHaveLength(2);
    expect(
      result.metadata.publicationStatements?.[0].parts.map(
        ({ subfield }) => subfield,
      ),
    ).toEqual(['a', 'a', 'c', 'e', 'g', 'd']);
    expect(result.metadata.publicationStatements?.[1].sortOrder).toBe(1);
    expect(
      result.metadata.publicationStatements?.[0].parts.map(
        ({ groupIndex }) => groupIndex,
      ),
    ).toEqual([0, 0, 0, 1, 1, 1]);
    expect(
      result.metadata.physicalDescriptions?.map(({ sortOrder }) => sortOrder),
    ).toEqual([0, 1]);
    expect(
      result.metadata.physicalDescriptions?.[0].parts.map(
        ({ subfield }) => subfield,
      ),
    ).toEqual(['a', 'c', 'd', 'e']);
  });

  it('parses series, typed notes, classifications and corporate contributors', () => {
    const result = parsePorbaseResponse(
      'record:1924216',
      enrichedCorpusExtract,
      'text/plain',
    );

    expect(result.metadata.series).toEqual([
      {
        title: 'Viagens na ficção',
        parallelTitle: 'Voyages in fiction',
        issn: '0873-7627',
        volumeNumber: '1',
        sortOrder: 0,
        sourceTag: '225',
      },
    ]);
    expect(
      result.metadata.notes.map(({ type, sourceTag }) => [type, sourceTag]),
    ).toEqual([
      ['GENERAL', '300'],
      ['PROVENANCE', '317'],
      ['BIBLIOGRAPHY', '320'],
      ['CONTENTS', '327'],
      ['DISSERTATION', '328'],
      ['SUMMARY', '330'],
    ]);
    expect(result.metadata.classifications).toEqual([
      {
        notation: '821.134.3-3',
        system: 'UDC',
        systemEdition: 'BN',
        authorityId: '12345',
        sortOrder: 0,
        sourceTag: '675',
      },
      {
        notation: '869.0',
        system: 'DDC',
        systemEdition: '23',
        authorityId: '67890',
        sortOrder: 1,
        sourceTag: '676',
      },
    ]);
    expect(result.metadata.contributions).toContainEqual(
      expect.objectContaining({
        sourceTag: '710',
        kind: 'CORPORATE_BODY',
        authorityId: '777',
      }),
    );
  });

  it('preserves local fields and unknown subfields as unmapped without leaking shelfmarks or classifications into identifiers', () => {
    const result = parsePorbaseResponse(
      'record:1924216',
      enrichedCorpusExtract,
      'text/plain',
    );

    expect(result.metadata.unmappedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: '900', reason: 'LOCAL' }),
        expect.objectContaining({ tag: '966', reason: 'LOCAL' }),
        expect.objectContaining({ tag: '972', reason: 'LOCAL' }),
        expect.objectContaining({
          tag: '200',
          reason: 'NOT_YET_MODELED',
          subfields: [
            expect.objectContaining({
              code: 'x',
              value: 'subcampo desconhecido',
            }),
          ],
        }),
        expect.objectContaining({
          tag: '200',
          reason: 'NOT_YET_MODELED',
          subfields: [
            expect.objectContaining({ code: 'z', value: 'subcampo futuro' }),
          ],
        }),
      ]),
    );
    expect(
      result.metadata.unmappedFields.find(({ tag }) => tag === '966')
        ?.subfields,
    ).toEqual([
      { code: 'l', value: 'BN', sortOrder: 0 },
      { code: 's', value: 'CT. 123 V.', sortOrder: 1 },
    ]);
    expect(
      result.metadata.sourceIdentifiers.map(({ type, value }) => [type, value]),
    ).not.toContainEqual(['CLASSIFICATION', '12345']);
    expect(result.metadata.sourceIdentifiers).not.toContainEqual(
      expect.objectContaining({ value: 'CT. 123 V.' }),
    );
  });

  it('applies the same structured extraction rules to MARCXchange XML', () => {
    const rawContent =
      '<collection><record format="Unimarc"><controlfield tag="001">xml-1</controlfield><datafield tag="200" ind1="1" ind2=" "><subfield code="a">Título XML</subfield><subfield code="d">Parallel XML</subfield><subfield code="f">Autor XML</subfield></datafield><datafield tag="101"><subfield code="a">por</subfield><subfield code="a">eng</subfield></datafield><datafield tag="710"><subfield code="a">Portugal. Exemplo</subfield><subfield code="3">corp-1</subfield></datafield><datafield tag="225"><subfield code="a">Série XML</subfield><subfield code="v">2</subfield></datafield><datafield tag="966"><subfield code="s">Shelf XML</subfield></datafield></record></collection>';
    const result = parsePorbaseResponse('xml-1', rawContent, 'text/xml');

    expect(
      result.metadata.titles.map(({ type, value }) => [type, value]),
    ).toEqual([
      ['MAIN', 'Título XML'],
      ['PARALLEL', 'Parallel XML'],
    ]);
    expect(result.metadata.languages.map(({ code }) => code)).toEqual([
      'por',
      'eng',
    ]);
    expect(result.metadata.contributions).toContainEqual(
      expect.objectContaining({
        sourceTag: '710',
        kind: 'CORPORATE_BODY',
        authorityId: 'corp-1',
      }),
    );
    expect(result.metadata.series[0]).toMatchObject({
      title: 'Série XML',
      volumeNumber: '2',
    });
    expect(result.metadata.unmappedFields).toContainEqual(
      expect.objectContaining({ tag: '966', reason: 'LOCAL' }),
    );
  });
});
