import type {
  MarcControlField,
  MarcDataField,
  MarcRecord,
  MarcSubfield,
} from '../marc-record.types.js';
import { validateMarcRecord } from '../marc-record.validation.js';

export const MARCXCHANGE_NAMESPACE = 'info:lc/xmlns/marcxchange-v2';

/**
 * Serializes the intermediate MarcRecord as the MARCXchange variant used by
 * PORBASE. This is deliberately not the Library of Congress MARCXML format.
 */
export function serializeMarcXchange(record: MarcRecord): string {
  validateMarcRecord(record);

  const controlFields = record.controlFields
    .map(serializeControlField)
    .join('\n');
  const dataFields = record.dataFields.map(serializeDataField).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<collection xmlns="${MARCXCHANGE_NAMESPACE}">`,
    '  <record format="Unimarc" type="bibliographic">',
    `    <leader>${escapeText(record.leader)}</leader>`,
    indent(controlFields, 4),
    indent(dataFields, 4),
    '  </record>',
    '</collection>',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

function serializeControlField(field: MarcControlField): string {
  return `    <controlfield tag="${escapeAttribute(field.tag)}">${escapeText(field.value)}</controlfield>`;
}

function serializeDataField(field: MarcDataField): string {
  const subfields = field.subfields.map(serializeSubfield).join('\n');

  return [
    `    <datafield ind1="${escapeAttribute(field.indicator1)}" ind2="${escapeAttribute(field.indicator2)}" tag="${escapeAttribute(field.tag)}">`,
    indent(subfields, 6),
    '    </datafield>',
  ].join('\n');
}

function serializeSubfield(field: MarcSubfield): string {
  return `      <subfield code="${escapeAttribute(field.code)}">${escapeText(field.value)}</subfield>`;
}

function indent(value: string, spaces: number): string {
  if (!value) return '';

  const prefix = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => `${prefix}${line.trimStart()}`)
    .join('\n');
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
