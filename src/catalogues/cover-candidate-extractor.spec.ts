import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PorbaseCoverCandidateExtractor } from './cover-candidate-extractor.js';

describe('PorbaseCoverCandidateExtractor', () => {
  const extractor = new PorbaseCoverCandidateExtractor();

  it('extracts repeated 856 subfields from MARC text and classifies candidates', async () => {
    const rawContent = [
      '856 40 $uhttps://covers.example.org/a.jpg $qimage/jpeg $yCover $zFront cover',
      '856 40 $uhttps://porbase.pt/record/1 $zPORBASE cover',
      '856 40 $uhttps://example.org/catalogue/1 $qtext/html',
    ].join('\n');

    const candidates = await extractor.extract({ id: 'record-1', rawContent });

    expect(candidates).toEqual([
      expect.objectContaining({
        url: 'https://covers.example.org/a.jpg',
        urlHash: createHash('sha256')
          .update('https://covers.example.org/a.jpg')
          .digest('hex'),
        sourceType: 'PORBASE',
        mimeType: 'image/jpeg',
        status: 'PENDING',
        rejectReason: null,
        linkLabel: 'Cover',
        note: 'Front cover',
      }),
      expect.objectContaining({
        url: 'https://porbase.pt/record/1',
        mimeType: null,
        status: 'PENDING',
        rejectReason: null,
        note: 'PORBASE cover',
      }),
      expect.objectContaining({
        url: 'https://example.org/catalogue/1',
        mimeType: 'text/html',
        status: 'REJECTED',
        rejectReason: 'NOT_IMAGE_LINK',
      }),
    ]);
  });

  it('extracts 856 links and metadata from MARCXchange XML', async () => {
    const rawContent = `<record xmlns="http://www.loc.gov/MARC21/slim">
      <datafield tag="856" ind1="4" ind2="0">
        <subfield code="u">https://images.example.net/cover.png</subfield>
        <subfield code="q">image/png</subfield>
        <subfield code="y">Capa</subfield>
        <subfield code="z">Capa frontal</subfield>
      </datafield>
    </record>`;

    await expect(
      extractor.extract({ id: 'record-xml', rawContent }),
    ).resolves.toEqual([
      expect.objectContaining({
        url: 'https://images.example.net/cover.png',
        mimeType: 'image/png',
        linkLabel: 'Capa',
        note: 'Capa frontal',
        status: 'PENDING',
      }),
    ]);
  });

  it.each([
    'http://covers.example.org/cover.jpg',
    'javascript:alert(1)',
    'not a url',
  ])('rejects non-HTTPS or malformed URL %s', async (url) => {
    const candidates = await extractor.extract({
      id: 'record-invalid',
      rawContent: `856 40 $u${url} $qimage/jpeg`,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'INVALID_URL',
    });
  });

  it('returns no candidates when there are no 856 fields', async () => {
    await expect(
      extractor.extract({ id: 'record-empty', rawContent: '200 $aTitle' }),
    ).resolves.toEqual([]);
  });
});
