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