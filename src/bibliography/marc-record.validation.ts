import type {
  MarcControlField,
  MarcDataField,
  MarcRecord,
  MarcSubfield,
} from './marc-record.types.js';

const TAG_PATTERN = /^\d{3}$/;

export function validateMarcRecord(record: MarcRecord): void {
  if (record.leader.length !== 24) {
    throw new Error(
      `MARC leader must contain exactly 24 characters; received ${record.leader.length}.`,
    );
  }

  record.controlFields.forEach((field, index) => {
    validateControlField(field, index);
  });

  record.dataFields.forEach((field, index) => {
    validateDataField(field, index);
  });
}

function validateControlField(field: MarcControlField, index: number): void {
  validateTag(field.tag, `controlFields[${index}].tag`);
  validateValue(field.value, `controlFields[${index}].value`);
}

function validateDataField(field: MarcDataField, index: number): void {
  const path = `dataFields[${index}]`;

  validateTag(field.tag, `${path}.tag`);
  validateIndicator(field.indicator1, `${path}.indicator1`);
  validateIndicator(field.indicator2, `${path}.indicator2`);

  if (field.subfields.length === 0) {
    throw new Error(`${path}.subfields must contain at least one subfield.`);
  }

  field.subfields.forEach((subfield, subfieldIndex) => {
    validateSubfield(subfield, `${path}.subfields[${subfieldIndex}]`);
  });
}

function validateSubfield(field: MarcSubfield, path: string): void {
  if (field.code.length !== 1) {
    throw new Error(
      `${path}.code must contain exactly one character; received ${field.code.length}.`,
    );
  }

  validateValue(field.value, `${path}.value`);
}

function validateTag(tag: string, path: string): void {
  if (!TAG_PATTERN.test(tag)) {
    throw new Error(`${path} must contain exactly three digits; received "${tag}".`);
  }
}

function validateIndicator(indicator: string, path: string): void {
  if (indicator.length !== 1) {
    throw new Error(
      `${path} must contain exactly one character; received ${indicator.length}.`,
    );
  }
}

function validateValue(value: string, path: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${path} must not be empty.`);
  }
}
