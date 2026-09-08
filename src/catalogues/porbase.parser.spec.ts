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
      [
        '215 $a 146, [6] p. $b il.',
        '215 $a 24 cm $d volume',
      ].join('\n'),
      'text/plain',
    );

    expect(result.metadata.extent).toBe('146, [6] p.');
    expect(result.metadata.physicalDescriptions).toEqual([
      { sortOrder: 0, source: 'PORBASE', parts: [
        { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
        { subfield: 'b', value: 'il.', sortOrder: 1 },
      ] },
      { sortOrder: 1, source: 'PORBASE', parts: [
        { subfield: 'a', value: '24 cm', sortOrder: 0 },
        { subfield: 'd', value: 'volume', sortOrder: 1 },
      ] },
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
      { sortOrder: 0, source: 'PORBASE', parts: [
        { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
        { subfield: 'b', value: 'il.', sortOrder: 1 },
      ] },
      { sortOrder: 1, source: 'PORBASE', parts: [
        { subfield: 'c', value: '24 cm', sortOrder: 0 },
        { subfield: 'd', value: 'volume', sortOrder: 1 },
      ] },
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
      expect.objectContaining({ sortOrder: 0, indicator1: '1', indicator2: '2', parts: [
        { subfield: 'a', value: '[S.l.]', sortOrder: 0, normalizedValue: null },
        { subfield: 'a', value: 'Lisboa', sortOrder: 1, normalizedValue: null },
        { subfield: 'd', value: 'D.L. 2009', sortOrder: 2, normalizedValue: '2009' },
      ] }),
      expect.objectContaining({ sortOrder: 1, indicator1: ' ', indicator2: '9' }),
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
    const result = parsePorbaseResponse(query, [
      '700 $a Doe $b Jane $c Dr. $4 aut $4 999 $2 relator $x unknown',
      '701 $a Roe $b Richard',
      '702 $a Smith $b Sam $4 730 $o id $r qualifier $5 local $6 link $8 control',
      '710 $a Ignored corporate body',
    ].join('\n'), 'text/plain');

    expect(result.metadata.contributions).toEqual([
      expect.objectContaining({ sourceTag: '700', targetScope: 'WORK', kind: 'PERSON', displayName: 'Doe, Jane', relationshipCodeScheme: 'relator', roleLabel: 'author' }),
      expect.objectContaining({ sourceTag: '701', displayName: 'Roe, Richard', roleLabel: 'author' }),
      expect.objectContaining({ sourceTag: '702', displayName: 'Smith, Sam', roleLabel: 'translator' }),
    ]);
    expect(result.metadata.contributions?.[0].sourceParts.map(({ code, value }) => [code, value])).toEqual([
      ['a', 'Doe'], ['b', 'Jane'], ['c', 'Dr.'], ['4', 'aut'], ['4', '999'], ['2', 'relator'], ['x', 'unknown'],
    ]);
    expect(result.metadata.contributions?.[2].sourceParts.map(({ code }) => code)).toEqual(['a', 'b', '4', 'o', 'r', '5', '6', '8']);
  });

  it('preserves unknown relationship codes without inventing a role label', () => {
    const result = parsePorbaseResponse(query, '702 $a Doe $b Jane $4 xyz', 'text/plain');
    expect(result.metadata.contributions?.[0]).toMatchObject({ sourceTag: '702', roleLabel: undefined });
    expect(result.metadata.contributions?.[0].sourceParts).toContainEqual(expect.objectContaining({ code: '4', value: 'xyz' }));
  });

  it('derives a personal display name from $a alone without qualifiers', () => {
    const result = parsePorbaseResponse(query, '700 $a Pessoa $c Dr. $f 1900-2000', 'text/plain');
    expect(result.metadata.contributions?.[0]).toMatchObject({ displayName: 'Pessoa' });
    expect(result.metadata.contributions?.[0].sourceParts.map(({ code }) => code)).toEqual(['a', 'c', 'f']);
  });
  it('normalizes empty and absent XML indicators while preserving supplied values', () => {
    const result = parsePorbaseResponse(
      query,
      '<collection><record><datafield tag="700" ind1="" ind2="1"><subfield code="a">Doe</subfield></datafield><datafield tag="702"><subfield code="a">Roe</subfield><subfield code="4">273</subfield></datafield><datafield tag="702" ind1="1" ind2="2"><subfield code="a">Smith</subfield></datafield></record></collection>',
      'text/xml',
    );

    expect(result.metadata.contributions).toEqual([
      expect.objectContaining({ sourceTag: '700', indicator1: ' ', indicator2: '1' }),
      expect.objectContaining({ sourceTag: '702', indicator1: ' ', indicator2: ' ' }),
      expect.objectContaining({ sourceTag: '702', indicator1: '1', indicator2: '2' }),
    ]);
  });
});