import type {
  BibliographicExportWarning,
  MarcDataField,
  MarcMappingResult,
  MarcRecord,
  MarcSubfield,
} from '../marc-record.types.js';
import { validateMarcRecord } from '../marc-record.validation.js';

/** Provisional 24-character leader for the initial local UNIMARC subset. */
export const PROVISIONAL_UNIMARC_LEADER = '00000nam a2200000 a 4500';

type Ordered = { sortOrder: number; id?: string };
type LocalTitle = Ordered & {
  type: 'MAIN' | 'PARALLEL' | 'VARIANT' | 'OTHER';
  value: string;
  subtitle?: string | null;
  language?: string | null;
};
type LocalResponsibilityStatement = Ordered & {
  label: 'STATEMENT' | 'SUBSEQUENT_STATEMENT';
  value: string;
};
type LocalLanguage = Ordered & {
  code: string;
  role: 'TEXT' | 'ORIGINAL_LANGUAGE' | 'PARALLEL_TEXT' | 'SUBTITLES';
};
type LocalEditionStatement = Ordered & {
  value: string;
  kind: string;
  label?: string | null;
  sourceTag: string;
};
type LocalSeries = Ordered & {
  title: string;
  parallelTitle?: string | null;
  volumeNumber?: string | null;
  issn?: string | null;
};
type LocalNote = Ordered & { type: string; value: string };
type LocalClassification = Ordered & {
  notation: string;
  system: string;
  systemEdition?: string | null;
  authorityId?: string | null;
};

export type LocalContribution = Ordered & {
  sourceTag: string | null;
  indicator1: string | null;
  indicator2: string | null;
  sourceParts: Array<{ code: string; value: string; sortOrder: number }>;
};

export type LocalExternalIdentifier = {
  id?: string;
  type: string;
  value: string;
};

export type LocalPhysicalDescription = Ordered & {
  parts: Array<{ subfield: string; value: string; sortOrder: number }>;
};

export type LocalPublicationStatement = Ordered & {
  indicator1: string;
  indicator2: string;
  parts: Array<{
    subfield: string;
    value: string;
    sortOrder: number;
    groupIndex?: number;
  }>;
};

export type UnimarcLocalEditionInput = {
  id: string;
  titles?: LocalTitle[];
  responsibilityStatements?: LocalResponsibilityStatement[];
  languages?: LocalLanguage[];
  editionStatements?: LocalEditionStatement[];
  series?: LocalSeries[];
  notes?: LocalNote[];
  classifications?: LocalClassification[];
  contributions?: LocalContribution[];
  work?: {
    titles?: LocalTitle[];
    notes?: LocalNote[];
    contributions?: LocalContribution[];
  } | null;
  publicationStatements?: LocalPublicationStatement[];
  physicalDescriptions?: LocalPhysicalDescription[];
  externalIdentifiers?: LocalExternalIdentifier[];
  legacyProjection?: {
    edition: {
      title?: string | null;
      subtitle?: string | null;
      isbn10?: string | null;
      isbn13?: string | null;
      publisher?: string | null;
      publicationDate?: string | null;
      publicationPlace?: string | null;
      language?: string | null;
      pageCount?: number | null;
    };
    work?: { title?: string | null } | null;
  };
  /** Transitional flat aliases accepted only for pre-1G callers. */
  title?: string | null;
  subtitle?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  publisher?: string | null;
  publicationDate?: string | null;
  publicationPlace?: string | null;
  language?: string | null;
  pageCount?: number | null;
};

/** Maps persisted canonical Folio data to the supported local UNIMARC subset. */
export function mapLocalEditionToUnimarc(
  edition: UnimarcLocalEditionInput,
): MarcMappingResult {
  const warnings: BibliographicExportWarning[] = [];
  const fields: MarcDataField[] = [];
  const legacy = edition.legacyProjection;
  const legacyEdition = legacy?.edition;
  const legacyWork = legacy?.work;

  appendIdentifiers(edition, fields, warnings);
  appendLanguages(
    edition,
    fields,
    warnings,
    legacyEdition?.language ?? edition.language,
  );
  appendTitles(edition, fields, warnings, legacyEdition, legacyWork);
  appendEditionStatements(edition.editionStatements, fields, warnings);
  appendPublicationStatements(edition, fields, warnings, legacyEdition);
  appendPhysicalDescriptions(
    edition,
    fields,
    warnings,
    legacyEdition?.pageCount ?? edition.pageCount,
  );
  appendSeries(edition.series, fields, warnings);
  appendNotes(edition, fields, warnings);
  appendClassifications(edition.classifications, fields, warnings);
  appendContributions(edition, fields, warnings);

  // Keep fields in profile order; stable sort preserves repetition order per tag.
  fields.sort((left, right) => left.tag.localeCompare(right.tag));
  const record: MarcRecord = {
    leader: PROVISIONAL_UNIMARC_LEADER,
    controlFields: [{ tag: '001', value: edition.id }],
    dataFields: fields,
  };
  validateMarcRecord(record);
  return { record, warnings };
}

function appendIdentifiers(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  const identifiers = edition.externalIdentifiers ?? [];
  const subfields: MarcSubfield[] = [];
  const seen = new Set<string>();
  for (const identifier of [...identifiers].sort((a, b) =>
    (a.id ?? '').localeCompare(b.id ?? ''),
  )) {
    if (!isNonEmpty(identifier.value)) continue;
    if (!isIsbn10(identifier.type) && !isIsbn13(identifier.type)) {
      warn(warnings, {
        code: 'unmapped_data',
        source: `ExternalIdentifier.${identifier.type}`,
        target: null,
        message: `External identifier type "${identifier.type}" is not mapped in the local UNIMARC profile.`,
        sourceValue: identifier.value,
        lossy: true,
      });
      continue;
    }
    const key = `${identifier.type.toUpperCase()}:${identifier.value}`;
    if (seen.has(key)) {
      warn(warnings, {
        code: 'lossy_mapping',
        source: `ExternalIdentifier.${identifier.type}`,
        target: '010$a',
        message:
          'Duplicate canonical ISBN was omitted from the exported field.',
        sourceValue: identifier.value,
        lossy: true,
      });
      continue;
    }
    seen.add(key);
    subfields.push({ code: 'a', value: identifier.value });
  }

  const legacy = edition.legacyProjection?.edition ?? edition;
  if (identifiers.length === 0) {
    for (const value of [legacy.isbn10, legacy.isbn13]) {
      if (isNonEmpty(value)) subfields.push({ code: 'a', value });
    }
    if (subfields.length)
      warn(warnings, {
        code: 'normalization',
        source: 'legacyProjection.edition.isbn',
        target: '010$a',
        message:
          'Legacy scalar ISBN projection was used because canonical external identifiers are absent.',
        lossy: true,
      });
  } else {
    const hasIsbn10 = identifiers.some(({ type }) => isIsbn10(type));
    const hasIsbn13 = identifiers.some(({ type }) => isIsbn13(type));
    for (const [type, value, isPresent] of [
      ['ISBN-10', legacy.isbn10, hasIsbn10],
      ['ISBN-13', legacy.isbn13, hasIsbn13],
    ] as const) {
      if (isNonEmpty(value) && !isPresent)
        warn(warnings, {
          code: 'lossy_mapping',
          source: `legacyProjection.edition.${type}`,
          target: '010$a',
          message: `Legacy ${type} was not used because canonical external identifiers are populated but contain no ${type}.`,
          sourceValue: value,
          lossy: true,
        });
    }
  }
  if (subfields.length) fields.push(dataField('010', ' ', ' ', subfields));
}

function appendLanguages(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
  legacyLanguage: string | null | undefined,
): void {
  const languages = sortByOrder(edition.languages ?? []);
  const subfields: MarcSubfield[] = [];
  if (languages.length > 0) {
    for (const language of languages) {
      if (!isNonEmpty(language.code)) continue;
      if (language.role === 'TEXT' || language.role === 'PARALLEL_TEXT') {
        subfields.push({ code: 'a', value: language.code });
        if (language.role === 'PARALLEL_TEXT')
          warn(warnings, {
            code: 'lossy_mapping',
            source: 'EditionLanguage.role:PARALLEL_TEXT',
            target: '101$a',
            message:
              'PARALLEL_TEXT is represented as 101$a; the canonical role is not encoded in this subfield.',
            sourceValue: language.code,
            lossy: true,
          });
      } else if (language.role === 'ORIGINAL_LANGUAGE') {
        subfields.push({ code: 'c', value: language.code });
      } else if (language.role === 'SUBTITLES') {
        subfields.push({ code: 'j', value: language.code });
        warn(warnings, {
          code: 'unsupported_value',
          source: 'EditionLanguage.role:SUBTITLES',
          target: '101$j',
          message: 'Subtitle-language mapping to 101$j is profile-dependent.',
          sourceValue: language.code,
          lossy: false,
        });
      } else {
        warn(warnings, {
          code: 'unmapped_data',
          source: `EditionLanguage.role:${String(language.role)}`,
          target: null,
          message: 'Unknown language role was not exported.',
          sourceValue: language.code,
          lossy: true,
        });
      }
    }
  } else if (isNonEmpty(legacyLanguage)) {
    subfields.push({ code: 'a', value: legacyLanguage });
    warn(warnings, {
      code: 'normalization',
      source: 'legacyProjection.edition.language',
      target: '101$a',
      message:
        'Legacy scalar language projection was used because canonical languages are absent.',
      lossy: true,
    });
  }
  if (subfields.length) {
    // Canonical language roles do not establish whether this is a translation.
    const indicator1 = languages.length > 0 ? ' ' : '0';
    fields.push(dataField('101', indicator1, ' ', subfields));
    if (languages.length > 0)
      warn(warnings, {
        code: 'unsupported_value',
        source: 'EditionLanguage.translationIndicator',
        target: '101.ind1',
        message:
          '101 indicator 1 is blank because canonical language roles do not establish whether the Edition is a translation.',
        lossy: false,
      });
  } else {
    warn(warnings, {
      code: 'missing_required_data',
      source: 'EditionLanguage',
      target: '101$a',
      message:
        'No exportable Edition language is available; 101 was not generated.',
      lossy: true,
    });
  }
}

function appendTitles(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
  legacyEdition:
    { title?: string | null; subtitle?: string | null } | undefined,
  legacyWork: { title?: string | null } | null | undefined,
): void {
  const editionTitles = sortByOrder(edition.titles ?? []);
  const workTitles = sortByOrder(edition.work?.titles ?? []);
  const editionMains = editionTitles.filter(
    (title) => title.type === 'MAIN' && isNonEmpty(title.value),
  );
  const workMains = workTitles.filter(
    (title) => title.type === 'MAIN' && isNonEmpty(title.value),
  );
  let main = editionMains[0];

  if (editionMains.length > 1)
    warn(warnings, {
      code: 'lossy_mapping',
      source: 'EditionTitle.type:MAIN',
      target: '200$a',
      message:
        'Only the first ordered Edition MAIN title can be selected as the record title.',
      lossy: true,
    });
  if (!main && workMains.length > 0) {
    main = workMains[0];
    warn(warnings, {
      code: 'lossy_mapping',
      source: 'WorkTitle.type:MAIN',
      target: '200$a',
      message:
        'Work MAIN title was used because no Edition MAIN title exists; Work/Edition scope is collapsed.',
      sourceValue: main.value,
      lossy: true,
    });
  }

  const legacy = edition.legacyProjection?.edition ?? edition;
  const fallbackTitle = isNonEmpty(legacy.title)
    ? legacy.title
    : legacyWork?.title;
  if (!main && editionTitles.length === 0 && isNonEmpty(fallbackTitle)) {
    const subfields = [{ code: 'a', value: fallbackTitle }];
    if (isNonEmpty(legacy.subtitle))
      subfields.push({ code: 'e', value: legacy.subtitle });
    fields.push(dataField('200', '1', ' ', subfields));
    warn(warnings, {
      code: 'normalization',
      source: 'legacyProjection.edition.title',
      target: '200$a',
      message:
        'Legacy scalar title projection was used because canonical title relations are empty.',
      sourceValue: fallbackTitle,
      lossy: true,
    });
    return;
  }

  const subfields: MarcSubfield[] = [];
  const otherTitleInformation: MarcSubfield[] = [];
  if (main) {
    subfields.push({ code: 'a', value: main.value });
    if (isNonEmpty(main.subtitle))
      otherTitleInformation.push({ code: 'e', value: main.subtitle });
  } else {
    warn(warnings, {
      code: 'missing_required_data',
      source: 'EditionTitle.type:MAIN',
      target: '200$a',
      message: 'No canonical MAIN title is available; 200$a was not generated.',
      lossy: true,
    });
  }

  const parallel = [...editionTitles, ...workTitles]
    .filter((title) => title.type === 'PARALLEL' && isNonEmpty(title.value))
    .sort(compareOrdered);
  for (const title of parallel)
    subfields.push({ code: 'd', value: title.value });
  for (const title of workTitles.filter(
    (entry) => entry.type === 'PARALLEL' && isNonEmpty(entry.value),
  ))
    warn(warnings, {
      code: 'lossy_mapping',
      source: 'WorkTitle.type:PARALLEL',
      target: '200$d',
      message:
        'Work-scoped parallel title was included in an Edition record; target scope is not represented.',
      sourceValue: title.value,
      lossy: true,
    });

  for (const title of editionTitles.filter((entry) => entry.type === 'OTHER')) {
    if (isNonEmpty(title.subtitle)) {
      otherTitleInformation.push({ code: 'e', value: title.subtitle });
      if (isNonEmpty(title.value))
        warn(warnings, {
          code: 'lossy_mapping',
          source: 'EditionTitle.type:OTHER',
          target: null,
          message:
            'OTHER title value was omitted; only its explicitly represented subtitle was mapped to 200$e.',
          sourceValue: title.value,
          lossy: true,
        });
    } else if (isNonEmpty(title.value))
      warn(warnings, {
        code: 'unmapped_data',
        source: 'EditionTitle.type:OTHER',
        target: null,
        message:
          'OTHER title has no explicit semantic indication that it is equivalent to 200$e.',
        sourceValue: title.value,
        lossy: true,
      });
  }
  for (const title of workTitles.filter(
    (entry) => entry.type === 'OTHER' && isNonEmpty(entry.value),
  ))
    warn(warnings, {
      code: 'unmapped_data',
      source: 'WorkTitle.type:OTHER',
      target: null,
      message:
        'Work OTHER title was not exported because its 200$e semantics and Edition scope are not established.',
      sourceValue: title.value,
      lossy: true,
    });

  subfields.push(...otherTitleInformation);
  const responsibilities = sortByOrder(edition.responsibilityStatements ?? []);
  for (const label of ['STATEMENT', 'SUBSEQUENT_STATEMENT'] as const) {
    for (const statement of responsibilities.filter(
      (entry) => entry.label === label,
    )) {
      if (isNonEmpty(statement.value))
        subfields.push({
          code: label === 'STATEMENT' ? 'f' : 'g',
          value: statement.value,
        });
    }
  }
  if (subfields.length > 0) fields.push(dataField('200', '1', ' ', subfields));

  for (const title of editionTitles.filter(
    (entry) => entry.type === 'VARIANT' && isNonEmpty(entry.value),
  )) {
    fields.push(
      dataField('517', ' ', ' ', [{ code: 'a', value: title.value }]),
    );
  }
  for (const title of workTitles.filter(
    (entry) => entry.type === 'VARIANT' && isNonEmpty(entry.value),
  ))
    warn(warnings, {
      code: 'lossy_mapping',
      source: 'WorkTitle.type:VARIANT',
      target: '517$a',
      message:
        'Work-scoped variant title was not copied to the Edition record.',
      sourceValue: title.value,
      lossy: true,
    });

  if (editionTitles.length === 0 && !main && isNonEmpty(legacy.subtitle))
    warn(warnings, {
      code: 'normalization',
      source: 'legacyProjection.edition.subtitle',
      target: '200$e',
      message:
        'Legacy subtitle was omitted because no canonical title relation exists to anchor it safely.',
      sourceValue: legacy.subtitle,
      lossy: true,
    });
}

function appendEditionStatements(
  statements: LocalEditionStatement[] | undefined,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  const codes: Record<string, string> = {
    EDITION: 'a',
    OTHER: 'b',
    RESPONSIBILITY: 'f',
  };
  const subfields: MarcSubfield[] = [];
  for (const statement of sortByOrder(statements ?? [])) {
    if (statement.sourceTag !== '205') {
      warn(warnings, {
        code: 'unmapped_data',
        source: `EditionStatement.sourceTag:${statement.sourceTag}`,
        target: null,
        message:
          'Edition statement with unsupported sourceTag was not exported.',
        sourceValue: statement.value,
        lossy: true,
      });
      continue;
    }
    const code = codes[statement.kind];
    if (!code) {
      warn(warnings, {
        code: 'unmapped_data',
        source: `EditionStatement.kind:${statement.kind}`,
        target: '205',
        message: 'Unknown edition statement kind was not exported.',
        sourceValue: statement.value,
        lossy: true,
      });
      continue;
    }
    if (isNonEmpty(statement.value))
      subfields.push({ code, value: statement.value });
  }
  if (subfields.length > 0) {
    fields.push(dataField('205', ' ', ' ', subfields));
    warn(warnings, {
      code: 'unsupported_value',
      source: 'EditionStatement.indicators',
      target: '205',
      message:
        '205 indicators use local profile blank defaults because indicators are not stored canonically.',
      lossy: false,
    });
  }
}

function appendPublicationStatements(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
  legacyEdition:
    | {
        publisher?: string | null;
        publicationDate?: string | null;
        publicationPlace?: string | null;
      }
    | undefined,
): void {
  const statements = sortByOrder(edition.publicationStatements ?? []);
  if (statements.length === 0) {
    const legacy = legacyEdition ?? edition;
    const subfields = [
      optionalSubfield('a', legacy.publicationPlace),
      optionalSubfield('c', legacy.publisher),
      optionalSubfield('d', serializePublishDate(legacy.publicationDate)),
    ].filter((part): part is MarcSubfield => Boolean(part));
    if (subfields.length > 0) {
      fields.push(dataField('210', ' ', ' ', subfields));
      warn(warnings, {
        code: 'normalization',
        source: 'legacyProjection.edition.publication',
        target: '210',
        message:
          'Legacy scalar publication projections were used because canonical publication statements are absent.',
        lossy: true,
      });
    }
    return;
  }

  for (const statement of statements) {
    const groups = new Map<number, typeof statement.parts>();
    for (const part of [...statement.parts].sort(compareOrdered)) {
      const index = part.groupIndex ?? 0;
      const group = groups.get(index) ?? [];
      group.push(part);
      groups.set(index, group);
    }
    const orderedGroups = [...groups.entries()].sort(([a], [b]) => a - b);
    if (orderedGroups.length > 1)
      warn(warnings, {
        code: 'lossy_mapping',
        source: 'PublicationStatementPart.groupIndex',
        target: '210',
        message:
          'One stored 210 occurrence was split into repeated 210 fields to preserve groupIndex boundaries.',
        sourceValue: String(statement.sortOrder),
        lossy: true,
      });
    if (orderedGroups.length === 0)
      warn(warnings, {
        code: 'lossy_mapping',
        source: 'PublicationStatement.parts',
        target: '210',
        message: 'Empty publication statement occurrence was not exported.',
        lossy: true,
      });
    for (const [, parts] of orderedGroups) {
      const subfields = parts
        .filter(
          ({ subfield, value }) =>
            /^[a-z0-9]$/.test(subfield) && isNonEmpty(value),
        )
        .map(({ subfield, value }) => ({ code: subfield, value }));
      if (subfields.length !== parts.length)
        warn(warnings, {
          code: 'lossy_mapping',
          source: 'PublicationStatement.parts',
          target: '210',
          message:
            'One or more empty or unsupported publication statement parts were omitted.',
          lossy: true,
        });
      if (subfields.length > 0)
        fields.push(
          dataField(
            '210',
            statement.indicator1,
            statement.indicator2,
            subfields,
          ),
        );
    }
  }
}

function appendPhysicalDescriptions(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
  pageCount: number | null | undefined,
): void {
  const descriptions = sortByOrder(edition.physicalDescriptions ?? []);
  if (descriptions.length > 0) {
    for (const description of descriptions) {
      const subfields = [...description.parts]
        .filter(
          ({ subfield, value }) =>
            /^[a-z0-9]$/.test(subfield) && isNonEmpty(value),
        )
        .sort(compareOrdered)
        .map(({ subfield, value }) => ({ code: subfield, value }));
      if (subfields.length !== description.parts.length)
        warn(warnings, {
          code: 'lossy_mapping',
          source: 'PhysicalDescription.parts',
          target: '215',
          message:
            'One or more empty or unsupported physical-description parts were omitted.',
          lossy: true,
        });
      if (subfields.length > 0)
        fields.push(dataField('215', ' ', ' ', subfields));
    }
    return;
  }
  if (
    typeof pageCount === 'number' &&
    Number.isInteger(pageCount) &&
    pageCount > 0
  ) {
    fields.push(
      dataField('215', ' ', ' ', [{ code: 'a', value: `${pageCount} p.` }]),
    );
    warn(warnings, {
      code: 'normalization',
      source: 'legacyProjection.edition.pageCount',
      target: '215$a',
      message:
        'Legacy derived pageCount was formatted because canonical physical descriptions are absent.',
      sourceValue: String(pageCount),
      lossy: true,
    });
  }
}

function appendSeries(
  seriesList: LocalSeries[] | undefined,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  for (const series of sortByOrder(seriesList ?? [])) {
    const subfields: MarcSubfield[] = [];
    if (isNonEmpty(series.title))
      subfields.push({ code: 'a', value: series.title });
    if (isNonEmpty(series.parallelTitle)) {
      subfields.push({ code: 'e', value: series.parallelTitle });
      warn(warnings, {
        code: 'lossy_mapping',
        source: 'Series.parallelTitle',
        target: '225$e',
        message:
          'Parallel series title is mapped to 225$e; its original source subfield is not stored canonically.',
        sourceValue: series.parallelTitle,
        lossy: true,
      });
    }
    if (isNonEmpty(series.volumeNumber))
      subfields.push({ code: 'v', value: series.volumeNumber });
    if (isNonEmpty(series.issn))
      subfields.push({ code: 'x', value: series.issn });
    if (subfields.length > 0) {
      fields.push(dataField('225', ' ', ' ', subfields));
      warn(warnings, {
        code: 'unsupported_value',
        source: 'Series.indicators',
        target: '225',
        message:
          '225 indicators use local profile blank defaults because indicators are not stored canonically.',
        lossy: false,
      });
    }
  }
}

function appendNotes(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  const tags: Record<string, string> = {
    GENERAL: '300',
    BIBLIOGRAPHY: '320',
    CONTENTS: '327',
    DISSERTATION: '328',
    SUMMARY: '330',
  };
  const items = [
    ...sortByOrder(edition.notes ?? []).map((note) => ({
      note,
      scope: 'Edition',
    })),
    ...sortByOrder(edition.work?.notes ?? []).map((note) => ({
      note,
      scope: 'Work',
    })),
  ];
  for (const { note, scope } of items) {
    if (note.type === 'PROVENANCE') {
      warn(warnings, {
        code: 'unsupported_value',
        source: `${scope} BibliographicNote.PROVENANCE`,
        target: null,
        message:
          'Provenance note was not exported because its Work/Edition scope does not match item provenance.',
        sourceValue: note.value,
        lossy: false,
      });
      continue;
    }
    const tag = tags[note.type];
    if (!tag) {
      warn(warnings, {
        code: 'unmapped_data',
        source: `${scope} BibliographicNote.${note.type}`,
        target: null,
        message: 'Unsupported bibliographic note type was not exported.',
        sourceValue: note.value,
        lossy: true,
      });
      continue;
    }
    if (!isNonEmpty(note.value)) continue;
    fields.push(dataField(tag, ' ', ' ', [{ code: 'a', value: note.value }]));
    warn(warnings, {
      code: 'unsupported_value',
      source: `${scope} BibliographicNote.indicators`,
      target: tag,
      message: `${tag} indicators use local profile blank defaults because indicators are not stored canonically.`,
      lossy: false,
    });
    if (scope === 'Work')
      warn(warnings, {
        code: 'lossy_mapping',
        source: 'Work.BibliographicNote',
        target: `${tag}$a`,
        message:
          'Work note was included in an Edition export; target scope is not encoded in this field.',
        sourceValue: note.value,
        lossy: true,
      });
  }
}

function appendClassifications(
  classifications: LocalClassification[] | undefined,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  const tags: Record<string, string> = {
    UDC: '675',
    DDC: '676',
    LCC: '680',
    OTHER: '686',
  };
  for (const classification of sortByOrder(classifications ?? [])) {
    const tag = tags[classification.system.toUpperCase()];
    if (!tag) {
      warn(warnings, {
        code: 'unmapped_data',
        source: `Classification.system:${classification.system}`,
        target: null,
        message: 'Unknown classification system was not exported.',
        sourceValue: classification.notation,
        lossy: true,
      });
      continue;
    }
    const subfields: MarcSubfield[] = [];
    if (isNonEmpty(classification.notation))
      subfields.push({ code: 'a', value: classification.notation });
    if (isNonEmpty(classification.systemEdition)) {
      subfields.push({ code: 'v', value: classification.systemEdition });
      warn(warnings, {
        code: 'lossy_mapping',
        source: 'Classification.systemEdition',
        target: `${tag}$v`,
        message:
          'System edition is mapped to $v, but the original source code ($v or $2) is not stored.',
        sourceValue: classification.systemEdition,
        lossy: true,
      });
    }
    if (isNonEmpty(classification.authorityId))
      subfields.push({ code: '3', value: classification.authorityId });
    if (subfields.length > 0) {
      fields.push(dataField(tag, ' ', ' ', subfields));
      warn(warnings, {
        code: 'unsupported_value',
        source: 'Classification.indicators',
        target: tag,
        message: `${tag} indicators use local profile blank defaults because indicators are not stored canonically.`,
        lossy: false,
      });
    }
  }
}

function appendContributions(
  edition: UnimarcLocalEditionInput,
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  appendContributionTarget(
    edition.contributions ?? [],
    'Edition',
    fields,
    warnings,
  );
  appendContributionTarget(
    edition.work?.contributions ?? [],
    'Work',
    fields,
    warnings,
  );
}

function appendContributionTarget(
  contributions: LocalContribution[],
  scope: 'Edition' | 'Work',
  fields: MarcDataField[],
  warnings: BibliographicExportWarning[],
): void {
  if (contributions.length > 0) {
    for (const contribution of sortByOrder(contributions)) {
      const tag = contribution.sourceTag ?? '';
      const parts = [...contribution.sourceParts]
        .filter(
          ({ code, value }) => /^[a-z0-9]$/i.test(code) && isNonEmpty(value),
        )
        .sort(compareOrdered)
        .map(({ code, value }) => ({ code, value }));
      if (
        !/^(70[0-9]|71[0-3])$/.test(tag) ||
        contribution.indicator1?.length !== 1 ||
        contribution.indicator2?.length !== 1 ||
        parts.length === 0
      ) {
        warn(warnings, {
          code: 'unmapped_data',
          source: `${scope} Contribution.${tag || 'sourceTag'}`,
          target: tag || null,
          message:
            'Contribution has an unsupported tag, incomplete indicators, or invalid source parts and was not exported.',
          lossy: true,
        });
        continue;
      }
      if (parts.length !== contribution.sourceParts.length)
        warn(warnings, {
          code: 'lossy_mapping',
          source: `${scope} Contribution.sourceParts`,
          target: tag,
          message:
            'One or more empty or unsupported contribution source parts were omitted.',
          lossy: true,
        });
      fields.push(
        dataField(tag, contribution.indicator1, contribution.indicator2, parts),
      );
      if (scope === 'Work')
        warn(warnings, {
          code: 'lossy_mapping',
          source: 'Work.Contribution',
          target: tag,
          message:
            'Work-scoped Contribution was included in an Edition export; target scope is not represented.',
          lossy: true,
        });
    }
    return;
  }
}

function dataField(
  tag: string,
  indicator1: string,
  indicator2: string,
  subfields: MarcSubfield[],
): MarcDataField {
  return { tag, indicator1, indicator2, subfields };
}

function optionalSubfield(
  code: string,
  value: string | null | undefined,
): MarcSubfield | undefined {
  return isNonEmpty(value) ? { code, value } : undefined;
}

function warn(
  warnings: BibliographicExportWarning[],
  warning: Omit<BibliographicExportWarning, 'field' | 'severity'> & {
    field?: string;
    severity?: 'info' | 'warning' | 'error';
  },
): void {
  warnings.push({
    severity: 'warning',
    field: warning.field ?? warning.target ?? undefined,
    ...warning,
  });
}

function sortByOrder<T extends Ordered>(values: T[]): T[] {
  return [...values].sort(compareOrdered);
}

function compareOrdered(left: Ordered, right: Ordered): number {
  return (
    left.sortOrder - right.sortOrder ||
    (left.id ?? '').localeCompare(right.id ?? '')
  );
}

function isIsbn10(type: string): boolean {
  return type.toUpperCase() === 'ISBN-10';
}
function isIsbn13(type: string): boolean {
  return type.toUpperCase() === 'ISBN-13';
}
function isNonEmpty(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.trim().length > 0;
}
function serializePublishDate(
  value: Date | string | null | undefined,
): string | undefined {
  return value instanceof Date ? value.toISOString() : (value ?? undefined);
}
