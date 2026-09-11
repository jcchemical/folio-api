import { describe, expect, it } from 'vitest';
import {
  BibliographicNoteType,
  EditionLanguageRole,
  ResponsibilityStatementLabel,
  TitleType,
  Prisma,
} from '@prisma/client';

// Schema-level tests for the Phase 1 canonical model foundation (Iteration
// 1F-API.1). No live database write happens here: these are Prisma
// `CreateInput` shape constructions, checked for structural correctness at
// build time (`npm run build`) and asserted at runtime for the shapes that
// production code will eventually construct in a later sub-iteration.

describe('Phase 1 canonical model - enums', () => {
  it('exposes the expected TitleType members', () => {
    expect(TitleType.MAIN).toBe('MAIN');
    expect(TitleType.PARALLEL).toBe('PARALLEL');
    expect(TitleType.VARIANT).toBe('VARIANT');
    expect(TitleType.OTHER).toBe('OTHER');
  });

  it('exposes the expected EditionLanguageRole members', () => {
    expect(EditionLanguageRole.TEXT).toBe('TEXT');
    expect(EditionLanguageRole.ORIGINAL_LANGUAGE).toBe('ORIGINAL_LANGUAGE');
    expect(EditionLanguageRole.PARALLEL_TEXT).toBe('PARALLEL_TEXT');
    expect(EditionLanguageRole.SUBTITLES).toBe('SUBTITLES');
  });

  it('exposes the expected ResponsibilityStatementLabel members', () => {
    expect(ResponsibilityStatementLabel.STATEMENT).toBe('STATEMENT');
    expect(ResponsibilityStatementLabel.SUBSEQUENT_STATEMENT).toBe(
      'SUBSEQUENT_STATEMENT',
    );
  });

  it('exposes the expected BibliographicNoteType members', () => {
    expect(BibliographicNoteType.GENERAL).toBe('GENERAL');
    expect(BibliographicNoteType.BIBLIOGRAPHY).toBe('BIBLIOGRAPHY');
    expect(BibliographicNoteType.CONTENTS).toBe('CONTENTS');
    expect(BibliographicNoteType.SUMMARY).toBe('SUMMARY');
    expect(BibliographicNoteType.PROVENANCE).toBe('PROVENANCE');
    expect(BibliographicNoteType.DISSERTATION).toBe('DISSERTATION');
    expect(BibliographicNoteType.OTHER).toBe('OTHER');
  });
});

describe('Phase 1 canonical model - titles', () => {
  it('supports multiple typed titles for a Work alongside the legacy scalar projection', () => {
    const input: Prisma.WorkCreateInput = {
      title: 'Vida e andanças de Alexis Zorbás',
      subtitle: null,
      organization: { connect: { id: 'org-1' } },
      titles: {
        create: [
          {
            type: TitleType.MAIN,
            value: 'Vida e andanças de Alexis Zorbás',
            sortOrder: 0,
          },
          {
            type: TitleType.VARIANT,
            value: 'Zorba the Greek',
            sortOrder: 1,
            source: 'PORBASE',
          },
        ],
      },
    };

    expect(input.titles?.create).toHaveLength(2);
    expect(input.title).toBe('Vida e andanças de Alexis Zorbás');
  });

  it('supports multiple typed titles for an Edition alongside the legacy scalar projection', () => {
    const input: Prisma.EditionCreateInput = {
      title: 'Cast a cold eye',
      subtitle: null,
      language: 'eng',
      work: { connect: { id: 'work-1' } },
      titles: {
        create: [
          { type: TitleType.MAIN, value: 'Cast a cold eye', sortOrder: 0 },
          {
            type: TitleType.PARALLEL,
            value: 'Olha friamente',
            language: 'por',
            sortOrder: 1,
          },
        ],
      },
    };

    expect(input.titles?.create).toHaveLength(2);
    expect(input.title).toBe('Cast a cold eye');
    expect(input.language).toBe('eng');
  });
});

describe('Phase 1 canonical model - responsibility statements', () => {
  it('preserves a verbatim, unparsed multi-name responsibility statement', () => {
    const input: Prisma.ResponsibilityStatementCreateInput = {
      label: ResponsibilityStatementLabel.STATEMENT,
      value: 'coord. Paulo Linhares Dias, Pedro Melo',
      sortOrder: 0,
      source: 'PORBASE',
      edition: { connect: { id: 'edition-1' } },
    };

    expect(input.value).toBe('coord. Paulo Linhares Dias, Pedro Melo');
    expect(input.label).toBe('STATEMENT');
  });
});

describe('Phase 1 canonical model - languages', () => {
  it('supports multiple languages per edition with distinct roles', () => {
    const input: Prisma.EditionLanguageCreateInput['role'][] = [
      EditionLanguageRole.TEXT,
      EditionLanguageRole.ORIGINAL_LANGUAGE,
    ];
    const creates: Prisma.EditionLanguageCreateWithoutEditionInput[] = [
      { code: 'por', role: EditionLanguageRole.TEXT, sortOrder: 0 },
      {
        code: 'gre',
        role: EditionLanguageRole.ORIGINAL_LANGUAGE,
        sortOrder: 1,
      },
    ];

    expect(creates).toHaveLength(2);
    expect(creates.map((c) => c.code)).toEqual(['por', 'gre']);
    expect(input).toEqual(['TEXT', 'ORIGINAL_LANGUAGE']);
  });
});

describe('Phase 1 canonical model - repeated publication statements and physical descriptions coexist', () => {
  it('creates an Edition with legacy publication/physical relations and the new relations together', () => {
    const input: Prisma.EditionCreateInput = {
      title: 'Vida e andanças de Alexis Zorbás',
      publisher: 'Edições 70',
      publicationDate: '2022',
      publicationPlace: 'Coimbra',
      work: { connect: { id: 'work-1' } },
      publicationStatements: {
        create: [
          {
            sortOrder: 0,
            indicator1: ' ',
            indicator2: '9',
            source: 'PORBASE',
            parts: {
              create: [
                { subfield: 'a', value: 'Coimbra', sortOrder: 0 },
                { subfield: 'c', value: 'Edições 70', sortOrder: 1 },
                { subfield: 'd', value: '2022', sortOrder: 2 },
              ],
            },
          },
        ],
      },
      physicalDescriptions: {
        create: [
          {
            sortOrder: 0,
            source: 'PORBASE',
            parts: {
              create: [
                { subfield: 'a', value: '383 p.', sortOrder: 0 },
                { subfield: 'd', value: '24 cm', sortOrder: 1 },
              ],
            },
          },
        ],
      },
      series: {
        create: [{ title: 'Nouvelle bibliothèque Plon', volumeNumber: '37' }],
      },
    };

    expect(input.publicationStatements?.create).toBeDefined();
    expect(input.physicalDescriptions?.create).toBeDefined();
    expect(input.series?.create).toBeDefined();
  });
});

describe('Phase 1 canonical model - series', () => {
  it('supports multiple repeated series per edition', () => {
    const creates: Prisma.SeriesCreateWithoutEditionInput[] = [
      { title: 'Cadernos do museu', issn: '0873-5484', volumeNumber: '14/15' },
      { title: 'Extra-colecção', sortOrder: 1 },
    ];

    expect(creates).toHaveLength(2);
    expect(creates[0].issn).toBe('0873-5484');
  });
});

describe('Phase 1 canonical model - classifications', () => {
  it('captures notation, system, systemEdition and authorityId', () => {
    const input: Prisma.ClassificationCreateInput = {
      notation: '821.14\'06-31"19"',
      system: 'UDC',
      systemEdition: null,
      authorityId: '1011261',
      source: 'PORBASE',
      edition: { connect: { id: 'edition-1' } },
    };

    expect(input.notation).toBe('821.14\'06-31"19"');
    expect(input.system).toBe('UDC');
    expect(input.authorityId).toBe('1011261');
  });

  it('supports repeated classifications per edition', () => {
    const creates: Prisma.ClassificationCreateWithoutEditionInput[] = [
      { notation: '347.72/.73(469)', system: 'UDC', sortOrder: 0 },
      { notation: '347.65/.69(469)', system: 'UDC', sortOrder: 1 },
    ];

    expect(creates).toHaveLength(2);
  });
});

describe('Phase 1 canonical model - typed notes', () => {
  it('targets exactly one of Work or Edition (application-level invariant mirroring the DB check)', () => {
    function assertExactlyOneTarget(target: {
      workId?: string;
      editionId?: string;
    }): void {
      if (Boolean(target.workId) === Boolean(target.editionId)) {
        throw new Error('A note must target exactly one of Work or Edition.');
      }
    }

    expect(() => assertExactlyOneTarget({ workId: 'work-1' })).not.toThrow();
    expect(() =>
      assertExactlyOneTarget({ editionId: 'edition-1' }),
    ).not.toThrow();
    expect(() =>
      assertExactlyOneTarget({ workId: 'work-1', editionId: 'edition-1' }),
    ).toThrow();
    expect(() => assertExactlyOneTarget({})).toThrow();
  });

  it('supports a typed note linked to a Work', () => {
    const input: Prisma.BibliographicNoteCreateInput = {
      type: BibliographicNoteType.PROVENANCE,
      value: 'Biblioteca Jorge de Sena',
      sortOrder: 0,
      source: 'PORBASE',
      work: { connect: { id: 'work-1' } },
    };

    expect(input.type).toBe('PROVENANCE');
    expect(input.work).toBeDefined();
    expect(input.edition).toBeUndefined();
  });

  it('supports a typed note linked to an Edition', () => {
    const input: Prisma.BibliographicNoteCreateInput = {
      type: BibliographicNoteType.SUMMARY,
      value: 'Contém bibliografia',
      sortOrder: 0,
      edition: { connect: { id: 'edition-1' } },
    };

    expect(input.type).toBe('SUMMARY');
    expect(input.edition).toBeDefined();
    expect(input.work).toBeUndefined();
  });
});

describe('Phase 1 canonical model - unmapped source fields', () => {
  it('matches the required tag/indicator1/indicator2/occurrence/subfields/reason JSON shape', () => {
    type UnmappedSourceFieldShape = {
      tag: string;
      indicator1: string | null;
      indicator2: string | null;
      occurrence: number;
      reason: string | null;
      subfields: Array<{ code: string; value: string }>;
    };

    const sample: UnmappedSourceFieldShape = {
      tag: '966',
      indicator1: ' ',
      indicator2: ' ',
      occurrence: 0,
      reason: 'Local BNP holdings field, not a bibliographic concept',
      subfields: [
        { code: 'l', value: 'BN' },
        { code: 's', value: 'RES. 2923 V.' },
      ],
    };

    expect(Object.keys(sample).sort()).toEqual(
      [
        'tag',
        'indicator1',
        'indicator2',
        'occurrence',
        'reason',
        'subfields',
      ].sort(),
    );
    expect(sample.subfields).toEqual(
      expect.arrayContaining([{ code: 'l', value: 'BN' }]),
    );

    const input: Prisma.UnmappedSourceFieldCreateInput = {
      tag: sample.tag,
      indicator1: sample.indicator1,
      indicator2: sample.indicator2,
      occurrence: sample.occurrence,
      reason: sample.reason,
      bibliographicRecord: { connect: { id: 'record-1' } },
      subfields: {
        create: sample.subfields.map((subfield, sortOrder) => ({
          code: subfield.code,
          value: subfield.value,
          sortOrder,
        })),
      },
    };

    expect(input.subfields?.create).toHaveLength(2);
  });
});

describe('Phase 1 canonical model - corporate contributions', () => {
  it('accepts UNIMARC corporate/meeting source tags (710-713) on Contribution', () => {
    const corporateSourceTags = ['710', '711', '712', '713'] as const;

    for (const sourceTag of corporateSourceTags) {
      const input: Prisma.ContributionCreateInput = {
        source: 'PORBASE',
        sourceTag,
        indicator1: '0',
        indicator2: '1',
        agent: { connect: { id: 'agent-1' } },
        work: { connect: { id: 'work-1' } },
      };
      expect(input.sourceTag).toBe(sourceTag);
    }
  });
});
