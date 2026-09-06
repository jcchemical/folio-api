import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import type { MarcRecord } from '../marc-record.types.js';
import { serializeMarcXchange } from './marcxchange.serializer.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
});

const record: MarcRecord = {
  leader: '00000nam a2200000 a 4500',
  controlFields: [
    { tag: '001', value: 'edition-1' },
    { tag: '003', value: 'Folio' },
  ],
  dataFields: [
    {
      tag: '010',
      indicator1: ' ',
      indicator2: ' ',
      subfields: [
        { code: 'a', value: '9789724426495' },
        { code: 'a', value: '972442649X' },
      ],
    },
    {
      tag: '101',
      indicator1: '1',
      indicator2: ' ',
      subfields: [{ code: 'a', value: 'por' }],
    },
    {
      tag: '200',
      indicator1: '1',
      indicator2: ' ',
      subfields: [
        { code: 'a', value: 'Título & principal' },
        { code: 'e', value: 'Subtítulo <especial>' },
        { code: 'e', value: 'Segundo subtítulo' },
      ],
    },
    {
      tag: '210',
      indicator1: ' ',
      indicator2: '9',
      subfields: [
        { code: 'a', value: 'Coimbra' },
        { code: 'c', value: 'Editora "Folio"' },
        { code: 'd', value: '2024' },
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
      subfields: [{ code: 'a', value: 'Autor, José' }],
    },
  ],
};

describe('MARCXchange serializer', () => {
  it('serializes the PORBASE MARCXchange structure with its namespace', () => {
    const xml = serializeMarcXchange(record);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<collection xmlns="info:lc/xmlns/marcxchange-v2">',
    );
    expect(xml).toContain('<record format="Unimarc" type="bibliographic">');
    expect(xml).toContain('<leader>00000nam a2200000 a 4500</leader>');
  });

  it('serializes control fields in their original order', () => {
    const xml = serializeMarcXchange(record);

    expect(xml.indexOf('tag="001"')).toBeLessThan(xml.indexOf('tag="003"'));
    expect(xml).toContain('<controlfield tag="001">edition-1</controlfield>');
    expect(xml).toContain('<controlfield tag="003">Folio</controlfield>');
  });

  it('serializes all requested datafield tags and their indicators', () => {
    const xml = serializeMarcXchange(record);

    expect(xml).toContain(
      '<datafield ind1=" " ind2=" " tag="010">',
    );
    expect(xml).toContain(
      '<datafield ind1="1" ind2=" " tag="101">',
    );
    expect(xml).toContain(
      '<datafield ind1="1" ind2=" " tag="200">',
    );
    expect(xml).toContain(
      '<datafield ind1=" " ind2="9" tag="210">',
    );
    expect(xml).toContain(
      '<datafield ind1=" " ind2=" " tag="215">',
    );
    expect(xml).toContain(
      '<datafield ind1=" " ind2=" " tag="700">',
    );
  });

  it('preserves repeated subfields and their order', () => {
    const xml = serializeMarcXchange(record);
    const firstSubtitle = xml.indexOf('Segundo subtítulo') - xml.indexOf('Subtítulo');

    expect(xml.match(/<subfield code="e">/g)).toHaveLength(2);
    expect(firstSubtitle).toBeGreaterThan(0);
    expect(xml.indexOf('code="a">9789724426495')).toBeLessThan(
      xml.indexOf('code="a">972442649X'),
    );
  });

  it('escapes XML text and attribute values without replacing Unicode', () => {
    const xml = serializeMarcXchange(record);
    const attributeRecord: MarcRecord = {
      ...record,
      dataFields: [
        { ...record.dataFields[0], indicator1: '"' },
      ],
    };
    const attributeXml = serializeMarcXchange(attributeRecord);

    expect(xml).toContain('Título &amp; principal');
    expect(xml).toContain('Subtítulo &lt;especial&gt;');
    expect(xml).toContain('Editora "Folio"');
    expect(attributeXml).toContain('<datafield ind1="&quot;"');
    expect(xml).toContain('Autor, José');
    expect(xml).not.toContain('Título & principal');
  });

  it('produces well-formed XML accepted by the project XML parser', () => {
    const parsed = xmlParser.parse(serializeMarcXchange(record));

    expect(parsed.collection.record['@_format']).toBe('Unimarc');
    expect(parsed.collection.record['@_type']).toBe('bibliographic');
    expect(parsed.collection.record.leader).toBe(record.leader);
    expect(parsed.collection.record.controlfield).toHaveLength(2);
    expect(parsed.collection.record.datafield).toHaveLength(6);
    expect(parsed.collection.record.datafield[2].subfield).toHaveLength(3);
    expect(parsed.collection.record.datafield[2].subfield[0]).toEqual({
      '@_code': 'a',
      '#text': 'Título & principal',
    });
  });

  it('rejects an invalid record before producing XML', () => {
    const invalidRecord: MarcRecord = {
      ...record,
      leader: 'invalid',
    };

    expect(() => serializeMarcXchange(invalidRecord)).toThrow(
      'MARC leader must contain exactly 24 characters',
    );
  });

  it('does not add warnings, rawContent, or unrelated fields to the XML', () => {
    const xml = serializeMarcXchange(record);

    expect(xml).not.toContain('rawContent');
    expect(xml).not.toContain('warning');
    expect(xml).not.toContain('<indicator1>');
    expect(xml).not.toContain('<indicator2>');
    expect(xml).not.toContain('<marcxml');
  });
});
