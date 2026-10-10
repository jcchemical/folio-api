import type {
  MarcDataField,
  MarcRecord,
  MarcSubfield,
} from '../marc-record.types.js';
import {
  mapLocalEditionToUnimarc,
  type UnimarcLocalEditionInput,
} from '../mappers/unimarc-local.mapper.js';
import { validateMarcRecord } from '../marc-record.validation.js';
import { serializeMarcXchange } from './marcxchange.serializer.js';

export function serializeCanonicalEditionMarcXchange(
  edition: UnimarcLocalEditionInput,
): string {
  const mapped = mapLocalEditionToUnimarc(edition).record;
  const record: MarcRecord = {
    leader: mapped.leader,
    controlFields: mapped.controlFields,
    dataFields: mapFieldsToMarc21(mapped.dataFields),
  };
  validateMarcRecord(record);
  return serializeMarcXchange(record, 'MARC21');
}

function mapFieldsToMarc21(fields: MarcDataField[]): MarcDataField[] {
  const mapped: MarcDataField[] = [];
  let hasPersonalMainEntry = false;
  let hasCorporateMainEntry = false;

  for (const field of fields) {
    switch (field.tag) {
      case '010':
        mapped.push(dataField('020', ' ', ' ', field.subfields));
        break;
      case '101':
        mapped.push(dataField('041', ' ', ' ', field.subfields));
        break;
      case '200':
        mapTitle(field, mapped);
        break;
      case '205':
        mapped.push(dataField('250', ' ', ' ', field.subfields));
        break;
      case '210':
        mapped.push(
          dataField(
            '264',
            ' ',
            '1',
            field.subfields.flatMap(mapPublicationSubfield),
          ),
        );
        break;
      case '215':
        mapped.push(dataField('300', ' ', ' ', field.subfields));
        break;
      case '225':
        mapped.push(
          dataField(
            '490',
            ' ',
            ' ',
            field.subfields.flatMap(mapSeriesSubfield),
          ),
        );
        break;
      case '300':
        mapped.push(dataField('500', ' ', ' ', field.subfields));
        break;
      case '320':
        mapped.push(dataField('504', ' ', ' ', field.subfields));
        break;
      case '327':
        mapped.push(dataField('505', ' ', ' ', field.subfields));
        break;
      case '328':
        mapped.push(dataField('502', ' ', ' ', field.subfields));
        break;
      case '330':
        mapped.push(dataField('520', ' ', ' ', field.subfields));
        break;
      case '517':
        mapped.push(dataField('246', '3', ' ', field.subfields));
        break;
      case '675':
        mapped.push(dataField('080', ' ', ' ', field.subfields));
        break;
      case '676':
        mapped.push(dataField('082', '0', '4', field.subfields));
        break;
      case '680':
        mapped.push(dataField('050', ' ', '4', field.subfields));
        break;
      case '700':
      case '701':
      case '702': {
        const tag: string =
          field.tag === '700' && !hasPersonalMainEntry ? '100' : '700';
        hasPersonalMainEntry ||= tag === '100';
        mapped.push(dataField(tag, field.indicator1, ' ', field.subfields));
        break;
      }
      case '710':
      case '711':
      case '712':
      case '713': {
        const tag: string =
          field.tag === '710' && !hasCorporateMainEntry ? '110' : '710';
        hasCorporateMainEntry ||= tag === '110';
        mapped.push(dataField(tag, field.indicator1, ' ', field.subfields));
        break;
      }
    }
  }

  return mapped.sort((left, right) => left.tag.localeCompare(right.tag));
}

function mapTitle(field: MarcDataField, output: MarcDataField[]): void {
  const titleParts: MarcSubfield[] = [];
  const parallelTitles: MarcSubfield[] = [];
  const responsibilities: string[] = [];

  for (const part of field.subfields) {
    if (part.code === 'a') titleParts.push(part);
    if (part.code === 'e') titleParts.push({ ...part, code: 'b' });
    if (part.code === 'd') parallelTitles.push({ ...part, code: 'a' });
    if (part.code === 'f' || part.code === 'g')
      responsibilities.push(part.value);
  }
  if (responsibilities.length > 0) {
    titleParts.push({ code: 'c', value: responsibilities.join('; ') });
  }
  if (titleParts.length > 0) {
    output.push(dataField('245', '1', '0', titleParts));
  }
  if (parallelTitles.length > 0) {
    output.push(dataField('246', '3', ' ', parallelTitles));
  }
}

function mapPublicationSubfield(part: MarcSubfield): MarcSubfield[] {
  const codes: Record<string, string> = {
    a: 'a',
    c: 'b',
    d: 'c',
    e: 'a',
    f: 'b',
    g: 'c',
  };
  const code = codes[part.code];
  return code ? [{ ...part, code }] : [];
}

function mapSeriesSubfield(part: MarcSubfield): MarcSubfield[] {
  if (part.code === 'a' || part.code === 'e') {
    return [{ ...part, code: 'a' }];
  }
  if (part.code === 'v' || part.code === 'x') return [part];
  return [];
}

function dataField(
  tag: string,
  indicator1: string,
  indicator2: string,
  subfields: MarcSubfield[],
): MarcDataField {
  return { tag, indicator1, indicator2, subfields };
}
