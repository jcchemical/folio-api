export type MarcRecord = {
  leader: string;
  controlFields: MarcControlField[];
  dataFields: MarcDataField[];
};

export type MarcControlField = {
  tag: string;
  value: string;
};

export type MarcDataField = {
  tag: string;
  indicator1: string;
  indicator2: string;
  subfields: MarcSubfield[];
};

export type MarcSubfield = {
  code: string;
  value: string;
};

export type BibliographicExportWarning = {
  field?: string;
  code:
    | 'missing_required_data'
    | 'normalization'
    | 'unmapped_data'
    | 'unsupported_value';
  message: string;
  sourceValue?: string;
};

export type MarcMappingResult = {
  record: MarcRecord;
  warnings: BibliographicExportWarning[];
};
