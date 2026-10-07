export const canonicalExportEditionId = `c${'e'.repeat(24)}`;
export const legacyFallbackEditionId = `c${'f'.repeat(24)}`;
export const canonicalExportOrganizationId = `c${'a'.repeat(24)}`;

const sourceParts = (parts: Array<[string, string]>) =>
  parts.map(([code, value], sortOrder) => ({ code, value, sortOrder }));

export const canonicalExportEdition = {
  id: canonicalExportEditionId,
  title: 'LEGACY EDITION TITLE MUST NOT EXPORT',
  subtitle: 'LEGACY EDITION SUBTITLE MUST NOT EXPORT',
  isbn10: '0306406152',
  isbn13: '9780000000000',
  publisher: 'LEGACY PUBLISHER MUST NOT EXPORT',
  publicationDate: '1999',
  publicationPlace: 'LEGACY PLACE MUST NOT EXPORT',
  language: 'deu',
  country: null,
  format: null,
  pageCount: 999,
  workId: 'export-work-1',
  titles: [
    {
      id: 'edition-title-main',
      type: 'MAIN',
      value: 'Canonical Edition Title',
      subtitle: 'Canonical Subtitle',
      language: 'por',
      sortOrder: 0,
    },
    {
      id: 'edition-title-parallel',
      type: 'PARALLEL',
      value: 'Titre parallèle',
      subtitle: null,
      language: 'fra',
      sortOrder: 1,
    },
    {
      id: 'edition-title-variant',
      type: 'VARIANT',
      value: 'Alternate Edition Title',
      subtitle: null,
      language: null,
      sortOrder: 2,
    },
  ],
  responsibilityStatements: [
    {
      id: 'responsibility-main',
      label: 'STATEMENT',
      value: 'por Ana Silva',
      sortOrder: 0,
    },
    {
      id: 'responsibility-subsequent',
      label: 'SUBSEQUENT_STATEMENT',
      value: 'tradução de Jo Lee',
      sortOrder: 1,
    },
  ],
  languages: [
    { id: 'language-text', code: 'por', role: 'TEXT', sortOrder: 0 },
    {
      id: 'language-parallel',
      code: 'eng',
      role: 'PARALLEL_TEXT',
      sortOrder: 1,
    },
    {
      id: 'language-original',
      code: 'fra',
      role: 'ORIGINAL_LANGUAGE',
      sortOrder: 2,
    },
    { id: 'language-subtitles', code: 'spa', role: 'SUBTITLES', sortOrder: 3 },
  ],
  editionStatements: [
    {
      id: 'edition-statement-edition',
      value: '2.ª edição',
      kind: 'EDITION',
      label: null,
      sortOrder: 0,
      sourceTag: '205',
    },
    {
      id: 'edition-statement-other',
      value: 'revista',
      kind: 'OTHER',
      label: null,
      sortOrder: 1,
      sourceTag: '205',
    },
    {
      id: 'edition-statement-responsibility',
      value: 'com notas de Ana Silva',
      kind: 'RESPONSIBILITY',
      label: null,
      sortOrder: 2,
      sourceTag: '205',
    },
  ],
  series: [
    {
      id: 'series-1',
      title: 'Colecção Folio',
      parallelTitle: 'Folio series',
      volumeNumber: '12',
      issn: '1234-5679',
      sortOrder: 0,
    },
  ],
  notes: [
    {
      id: 'note-general',
      type: 'GENERAL',
      value: 'Canonical general note',
      sortOrder: 0,
    },
    {
      id: 'note-bibliography',
      type: 'BIBLIOGRAPHY',
      value: 'Bibliography note',
      sortOrder: 1,
    },
    {
      id: 'note-contents',
      type: 'CONTENTS',
      value: 'Contents note',
      sortOrder: 2,
    },
    {
      id: 'note-summary',
      type: 'SUMMARY',
      value: 'Summary note',
      sortOrder: 3,
    },
    {
      id: 'note-dissertation',
      type: 'DISSERTATION',
      value: 'Dissertation note',
      sortOrder: 4,
    },
    {
      id: 'note-provenance',
      type: 'PROVENANCE',
      value: 'ITEM PROVENANCE MUST NOT EXPORT',
      sortOrder: 5,
    },
  ],
  classifications: [
    {
      id: 'classification-udc',
      notation: '821.134.3',
      system: 'UDC',
      systemEdition: null,
      authorityId: null,
      sortOrder: 0,
    },
  ],
  contributions: [
    {
      id: 'contribution-700',
      sortOrder: 0,
      sourceTag: '700',
      indicator1: '1',
      indicator2: ' ',
      agent: {
        id: 'agent-personal',
        displayName: 'AGENT DISPLAY NAME MUST NOT EXPORT',
      },
      sourceParts: sourceParts([
        ['a', 'Silva, Ana'],
        ['4', '070'],
      ]),
    },
    {
      id: 'contribution-701',
      sortOrder: 1,
      sourceTag: '701',
      indicator1: '1',
      indicator2: ' ',
      agent: {
        id: 'agent-personal-2',
        displayName: 'SECOND AGENT DISPLAY MUST NOT EXPORT',
      },
      sourceParts: sourceParts([
        ['a', 'Costa, Rui'],
        ['4', '070'],
      ]),
    },
    {
      id: 'contribution-702',
      sortOrder: 2,
      sourceTag: '702',
      indicator1: '0',
      indicator2: ' ',
      agent: {
        id: 'agent-personal-3',
        displayName: 'THIRD AGENT DISPLAY MUST NOT EXPORT',
      },
      sourceParts: sourceParts([
        ['a', 'Lee, Jo'],
        ['4', '730'],
      ]),
    },
    {
      id: 'contribution-710',
      sortOrder: 3,
      sourceTag: '710',
      indicator1: '2',
      indicator2: ' ',
      agent: {
        id: 'agent-corporate',
        displayName: 'CORPORATE DISPLAY NAME MUST NOT EXPORT',
      },
      sourceParts: sourceParts([
        ['a', 'Associação Folio'],
        ['4', '070'],
      ]),
    },
    {
      id: 'contribution-711',
      sortOrder: 4,
      sourceTag: '711',
      indicator1: '2',
      indicator2: ' ',
      agent: {
        id: 'agent-corporate-2',
        displayName: 'SECOND CORPORATE DISPLAY MUST NOT EXPORT',
      },
      sourceParts: sourceParts([
        ['a', 'Fundação Exemplo'],
        ['4', '070'],
      ]),
    },
    {
      id: 'contribution-712',
      sortOrder: 5,
      sourceTag: '712',
      indicator1: '2',
      indicator2: ' ',
      agent: {
        id: 'agent-corporate-3',
        displayName: 'THIRD CORPORATE DISPLAY MUST NOT EXPORT',
      },
      sourceParts: sourceParts([
        ['a', 'Instituto Canónico'],
        ['4', '570'],
      ]),
    },
  ],
  externalIdentifiers: [
    { id: 'identifier-isbn-13', type: 'ISBN-13', value: '9789724426495' },
    { id: 'identifier-porbase', type: 'PORBASE', value: 'record-123' },
  ],
  physicalDescriptions: [
    {
      id: 'physical-1',
      sortOrder: 0,
      parts: [
        {
          id: 'physical-part-1',
          subfield: 'a',
          value: '146, [6] p.',
          sortOrder: 0,
        },
        { id: 'physical-part-2', subfield: 'b', value: 'il.', sortOrder: 1 },
        { id: 'physical-part-3', subfield: 'd', value: '24 cm', sortOrder: 2 },
      ],
    },
  ],
  publicationStatements: [
    {
      id: 'publication-1',
      sortOrder: 0,
      indicator1: ' ',
      indicator2: '9',
      parts: [
        {
          id: 'publication-part-a',
          subfield: 'a',
          value: 'Lisboa',
          sortOrder: 0,
          groupIndex: 0,
        },
        {
          id: 'publication-part-c',
          subfield: 'c',
          value: 'Editora Canónica',
          sortOrder: 1,
          groupIndex: 0,
        },
        {
          id: 'publication-part-d',
          subfield: 'd',
          value: '2024',
          sortOrder: 2,
          groupIndex: 0,
        },
        {
          id: 'publication-part-e',
          subfield: 'e',
          value: 'Porto',
          sortOrder: 3,
          groupIndex: 1,
        },
        {
          id: 'publication-part-f',
          subfield: 'f',
          value: 'Imprensa Canónica',
          sortOrder: 4,
          groupIndex: 1,
        },
      ],
    },
  ],
  work: {
    id: 'export-work-1',
    title: 'LEGACY WORK TITLE MUST NOT EXPORT',
    organizationId: canonicalExportOrganizationId,
    titles: [
      {
        id: 'work-title-main',
        type: 'MAIN',
        value: 'Canonical Work Title',
        subtitle: null,
        language: null,
        sortOrder: 0,
      },
    ],
    notes: [],
    contributions: [
      {
        id: 'contribution-713',
        sortOrder: 0,
        sourceTag: '713',
        indicator1: '2',
        indicator2: ' ',
        agent: {
          id: 'agent-corporate-4',
          displayName: 'FOURTH CORPORATE DISPLAY MUST NOT EXPORT',
        },
        sourceParts: sourceParts([
          ['a', 'Consórcio Canónico'],
          ['4', '070'],
        ]),
      },
    ],
  },
  bibliographicRecords: [
    {
      rawContent:
        '<provider-content>RAW PROVIDER CONTENT MUST NOT EXPORT</provider-content>',
      unmappedSourceFields: [
        {
          tag: '966',
          subfields: [
            { code: 's', value: 'UNMAPPED SHELF VALUE MUST NOT EXPORT' },
          ],
        },
      ],
    },
  ],
};

export const legacyFallbackEdition = {
  id: legacyFallbackEditionId,
  title: 'Legacy fallback title',
  subtitle: 'Legacy fallback subtitle',
  isbn10: '0306406152',
  isbn13: null,
  publisher: 'Legacy fallback publisher',
  publicationDate: '2001',
  publicationPlace: 'Coimbra',
  language: 'por',
  country: null,
  format: null,
  pageCount: 100,
  workId: 'legacy-work-1',
  work: {
    id: 'legacy-work-1',
    title: 'Legacy fallback work title',
    organizationId: canonicalExportOrganizationId,
    titles: [],
    notes: [],
    contributions: [],
  },
  titles: [],
  responsibilityStatements: [],
  languages: [],
  editionStatements: [],
  series: [],
  notes: [],
  classifications: [],
  contributions: [],
  externalIdentifiers: [],
  physicalDescriptions: [],
  publicationStatements: [],
};
