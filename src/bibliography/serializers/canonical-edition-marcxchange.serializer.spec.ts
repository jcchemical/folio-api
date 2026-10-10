import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import type { UnimarcLocalEditionInput } from '../mappers/unimarc-local.mapper.js';
import { serializeCanonicalEditionMarcXchange } from './canonical-edition-marcxchange.serializer.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
});

describe('Canonical Edition MARCXchange serializer', () => {
  it('serializes the canonical model as structurally valid MARC21 MARCXchange', () => {
    const edition: UnimarcLocalEditionInput = {
      id: 'edition-1',
      titles: [
        {
          type: 'MAIN',
          value: 'Canonical title',
          subtitle: 'Canonical subtitle',
          sortOrder: 0,
        },
      ],
      responsibilityStatements: [
        { label: 'STATEMENT', value: 'A. Writer', sortOrder: 0 },
      ],
      externalIdentifiers: [
        { type: 'ISBN-13', value: '9780000000000' },
        { type: 'PORBASE', value: 'provider-record-1' },
      ],
      contributions: [
        {
          sortOrder: 0,
          sourceTag: '700',
          indicator1: '1',
          indicator2: ' ',
          sourceParts: [
            { code: 'a', value: 'Writer, A.', sortOrder: 0 },
            { code: '4', value: '070', sortOrder: 1 },
          ],
        },
      ],
      notes: [
        { type: 'GENERAL', value: 'Canonical note', sortOrder: 0 },
        { type: 'PROVENANCE', value: 'Must not be exported', sortOrder: 1 },
      ],
    };

    const xml = serializeCanonicalEditionMarcXchange(edition);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('<collection xmlns="info:lc/xmlns/marcxchange-v2">');
    const parsed = parser.parse(xml) as {
      collection: {
        record: {
          '@_format': string;
          leader: string;
          controlfield: { '@_tag': string; '#text': string };
          datafield: Array<{
            '@_tag': string;
            subfield:
              | Array<{ '@_code': string; '#text': string }>
              | { '@_code': string; '#text': string };
          }>;
        };
      };
    };
    const { record } = parsed.collection;
    const fields = record.datafield;
    const fieldValues = (tag: string, code: string) =>
      fields
        .filter((field) => field['@_tag'] === tag)
        .flatMap((field) =>
          Array.isArray(field.subfield) ? field.subfield : [field.subfield],
        )
        .filter((subfield) => subfield['@_code'] === code)
        .map((subfield) => subfield['#text']);

    expect(record['@_format']).toBe('MARC21');
    expect(record.leader).toHaveLength(24);
    expect(record.controlfield).toEqual({
      '@_tag': '001',
      '#text': 'edition-1',
    });
    expect(fieldValues('245', 'a')).toEqual(['Canonical title']);
    expect(fieldValues('245', 'b')).toEqual(['Canonical subtitle']);
    expect(fieldValues('245', 'c')).toEqual(['A. Writer']);
    expect(fieldValues('020', 'a')).toEqual(['9780000000000']);
    expect(fieldValues('100', 'a')).toEqual(['Writer, A.']);
    expect(fieldValues('500', 'a')).toEqual(['Canonical note']);
    expect(xml).not.toContain('provider-record-1');
    expect(xml).not.toContain('Must not be exported');
  });
});
