import type { UnimarcLocalEditionInput } from '../unimarc-local.mapper.js';

export const canonicalEditionFixture: UnimarcLocalEditionInput = {
  id: 'edition-canonical-1',
  titles: [
    {
      id: 'edition-title-main',
      type: 'MAIN',
      value: 'Título da edição',
      subtitle: 'Subtítulo canónico',
      language: 'por',
      sortOrder: 0,
    },
    {
      id: 'edition-title-parallel',
      type: 'PARALLEL',
      value: 'Edition title',
      language: 'eng',
      sortOrder: 1,
    },
    {
      id: 'edition-title-variant',
      type: 'VARIANT',
      value: 'Título alternativo',
      sortOrder: 2,
    },
    {
      id: 'edition-title-other',
      type: 'OTHER',
      value: 'Informação de título não classificada',
      sortOrder: 3,
    },
  ],
  responsibilityStatements: [
    {
      id: 'responsibility-1',
      label: 'STATEMENT',
      value: 'por Ana Silva',
      sortOrder: 0,
    },
    {
      id: 'responsibility-2',
      label: 'STATEMENT',
      value: 'e Rui Costa',
      sortOrder: 1,
    },
    {
      id: 'responsibility-3',
      label: 'SUBSEQUENT_STATEMENT',
      value: 'tradução de Lee',
      sortOrder: 2,
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
      id: 'edition-statement-1',
      value: '2.ª edição',
      kind: 'EDITION',
      label: null,
      sortOrder: 0,
      sourceTag: '205',
    },
    {
      id: 'edition-statement-2',
      value: 'revista',
      kind: 'OTHER',
      label: null,
      sortOrder: 1,
      sourceTag: '205',
    },
    {
      id: 'edition-statement-3',
      value: 'por Ana Silva',
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
    { id: 'note-general', type: 'GENERAL', value: 'Nota geral', sortOrder: 0 },
    {
      id: 'note-bibliography',
      type: 'BIBLIOGRAPHY',
      value: 'Contém bibliografia',
      sortOrder: 1,
    },
    {
      id: 'note-contents',
      type: 'CONTENTS',
      value: 'Conteúdo em texto livre',
      sortOrder: 2,
    },
    {
      id: 'note-dissertation',
      type: 'DISSERTATION',
      value: 'Dissertação',
      sortOrder: 3,
    },
    { id: 'note-summary', type: 'SUMMARY', value: 'Resumo', sortOrder: 4 },
    {
      id: 'note-provenance',
      type: 'PROVENANCE',
      value: 'Proveniência do exemplar',
      sortOrder: 5,
    },
    {
      id: 'note-other',
      type: 'OTHER',
      value: 'Nota não classificada',
      sortOrder: 6,
    },
  ],
  classifications: [
    {
      id: 'classification-udc',
      notation: '821.134.3',
      system: 'UDC',
      systemEdition: '2019',
      authorityId: 'authority-udc',
      sortOrder: 0,
    },
    {
      id: 'classification-ddc',
      notation: '869.3',
      system: 'DDC',
      sortOrder: 1,
    },
    {
      id: 'classification-lcc',
      notation: 'PQ9261',
      system: 'LCC',
      sortOrder: 2,
    },
    {
      id: 'classification-other',
      notation: 'LOCAL-7',
      system: 'OTHER',
      sortOrder: 3,
    },
  ],
  contributions: [
    {
      id: 'edition-contribution-700',
      sortOrder: 0,
      sourceTag: '700',
      indicator1: '1',
      indicator2: ' ',
      sourceParts: [
        { code: 'a', value: 'Silva, Ana', sortOrder: 0 },
        { code: '4', value: '070', sortOrder: 1 },
      ],
    },
    {
      id: 'edition-contribution-710',
      sortOrder: 1,
      sourceTag: '710',
      indicator1: '2',
      indicator2: ' ',
      sourceParts: [
        { code: 'a', value: 'Associação Folio', sortOrder: 0 },
        { code: '4', value: '070', sortOrder: 1 },
        { code: '4', value: '570', sortOrder: 2 },
      ],
    },
  ],
  work: {
    titles: [
      {
        id: 'work-title-main',
        type: 'MAIN',
        value: 'Título da obra',
        sortOrder: 0,
      },
      {
        id: 'work-title-variant',
        type: 'VARIANT',
        value: 'Variante da obra',
        sortOrder: 1,
      },
    ],
    notes: [
      { id: 'work-note', type: 'GENERAL', value: 'Nota da obra', sortOrder: 0 },
    ],
    contributions: [
      {
        id: 'work-contribution-713',
        sortOrder: 0,
        sourceTag: '713',
        indicator1: '2',
        indicator2: ' ',
        sourceParts: [{ code: 'a', value: 'Fundação Exemplo', sortOrder: 0 }],
      },
    ],
  },
  publicationStatements: [
    {
      id: 'publication-1',
      sortOrder: 0,
      indicator1: ' ',
      indicator2: '9',
      parts: [
        { subfield: 'a', value: 'Lisboa', sortOrder: 0, groupIndex: 0 },
        {
          subfield: 'c',
          value: 'Editora Canónica',
          sortOrder: 1,
          groupIndex: 0,
        },
        { subfield: 'd', value: '2024', sortOrder: 2, groupIndex: 0 },
        { subfield: 'e', value: 'Porto', sortOrder: 3, groupIndex: 1 },
        { subfield: 'f', value: 'Distribuidora', sortOrder: 4, groupIndex: 1 },
      ],
    },
  ],
  physicalDescriptions: [
    {
      id: 'physical-1',
      sortOrder: 0,
      parts: [
        { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
        { subfield: 'b', value: 'il.', sortOrder: 1 },
        { subfield: 'd', value: '24 cm', sortOrder: 2 },
      ],
    },
  ],
  externalIdentifiers: [
    { id: 'identifier-isbn13', type: 'ISBN-13', value: '9789724426495' },
    { id: 'identifier-porbase', type: 'PORBASE', value: 'record-123' },
  ],
  legacyProjection: {
    edition: {
      title: 'Título escalar obsoleto',
      subtitle: 'Subtítulo escalar obsoleto',
      isbn10: '0306406152',
      isbn13: '9780000000000',
      publisher: 'Editora escalar',
      publicationDate: '1999',
      publicationPlace: 'Lugar escalar',
      language: 'eng',
      pageCount: 999,
    },
    work: { title: 'Título escalar da obra' },
  },
};
