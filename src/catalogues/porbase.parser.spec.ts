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
      field: 'edition.publishDate',
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
      field: 'edition.publishDate',
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
      { subfield: 'a', value: '146, [6] p.', sortOrder: 0, source: 'PORBASE' },
      { subfield: 'b', value: 'il.', sortOrder: 1, source: 'PORBASE' },
      { subfield: 'a', value: '24 cm', sortOrder: 2, source: 'PORBASE' },
      { subfield: 'd', value: 'volume', sortOrder: 3, source: 'PORBASE' },
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
      { subfield: 'a', value: '146, [6] p.', sortOrder: 0, source: 'PORBASE' },
      { subfield: 'b', value: 'il.', sortOrder: 1, source: 'PORBASE' },
      { subfield: 'c', value: '24 cm', sortOrder: 2, source: 'PORBASE' },
      { subfield: 'd', value: 'volume', sortOrder: 3, source: 'PORBASE' },
    ]);
  });
});