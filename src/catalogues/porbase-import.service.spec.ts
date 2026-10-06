import { describe, expect, it, vi } from 'vitest';
import { ContributionsService } from '../contributions/contributions.service.js';
import { PorbaseImportService } from './porbase-import.service.js';
import type { CatalogueImportDto } from './dto/catalogue-import.dto.js';

const baseInput: CatalogueImportDto = {
  work: { title: 'Work title', subtitle: null },
  edition: {
    title: 'Edition title',
    subtitle: null,
    isbn10: null,
    isbn13: '9789724426495',
    publisher: 'Publisher',
    publicationDate: '2022',
    language: 'por',
    country: 'PT',
    format: null,
    physicalDescriptions: [
      {
        sortOrder: 0,
        source: 'PORBASE',
        parts: [
          { subfield: 'a', value: '383 p.', sortOrder: 0 },
          { subfield: 'd', value: '24 cm', sortOrder: 1 },
        ],
      },
    ],
  },
  contributors: [
    { name: '  Jane   Doe ', role: 'AUTHOR', scope: 'WORK', sortOrder: 0 },
    { name: 'John Smith', role: 'TRANSLATOR', scope: 'EDITION', sortOrder: 0 },
  ],
  externalIdentifiers: [
    { type: 'ISBN-13', value: '978-972-44-2649-5', source: 'PORBASE' },
    { type: 'PORBASE', value: 'record-1', source: 'PORBASE' },
  ],
  bibliographicRecord: {
    format: 'MARCXCHANGE',
    remoteId: 'record-1',
    rawContent: '<collection />',
  },
  item: {
    label: null,
    location: null,
    status: 'OWNED',
    notes: null,
  },
};

function createTransactionMock(organizationId = 'organization-1') {
  const work = { id: 'work-1' };
  const edition = { id: 'edition-1' };
  const contributor = { id: 'contributor-1', name: 'Jane Doe' };
  const tx = {
    edition: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(edition),
    },
    work: {
      create: vi.fn().mockResolvedValue(work),
      findUnique: vi.fn().mockResolvedValue({ ...work, organizationId }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: work.id,
        organization: { id: 'organization-1' },
        titles: [],
        editions: [
          {
            ...edition,
            externalIdentifiers: [],
            bibliographicRecords: [
              {
                id: 'record-1',
                format: 'MARCXCHANGE',
                source: 'PORBASE',
                sourceId: 'porbase',
                remoteId: 'record-1',
                rawContent: '<collection />',
                unmappedSourceFields: [],
              },
            ],
            items: [],
            editionContributors: [],
            titles: [],
            responsibilityStatements: [],
            languages: [],
            series: [],
            notes: [],
            classifications: [],
          },
        ],
        workContributors: [],
        bibliographicRecords: [],
      }),
    },
    contributor: {
      findMany: vi.fn().mockResolvedValue([contributor]),
      create: vi
        .fn()
        .mockResolvedValue({ id: 'contributor-2', name: 'John Smith' }),
    },
    workContributor: { create: vi.fn().mockResolvedValue({}) },
    editionContributor: { create: vi.fn().mockResolvedValue({}) },
    agent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: `agent-${organizationId}`,
          ...data,
        })),
    },
    contribution: {
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: `contribution-${organizationId}`,
          ...data,
        })),
    },
    externalIdentifier: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    bibliographicRecord: {
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...data,
            id: 'record-1',
            source: 'PORBASE',
            sourceId: 'porbase',
            unmappedSourceFields: [],
          }),
        ),
    },
    coverCandidate: { upsert: vi.fn().mockResolvedValue({}) },
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    item: { create: vi.fn().mockResolvedValue({ id: 'item-1' }) },
  };

  return { tx, work, edition };
}

describe('PorbaseImportService', () => {
  it('persists a valid import atomically using the authenticated user id', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    const result = await service.import('jwt-user-1', baseInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'organization-1' }),
    });
    expect(tx.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'organization-1' }),
    });
    expect(tx.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publicationDate: '2022',
        pageCount: 383,
        physicalDescriptions: expect.objectContaining({
          create: [
            expect.objectContaining({
              sortOrder: 0,
              parts: expect.objectContaining({
                create: [
                  expect.objectContaining({ subfield: 'a', value: '383 p.' }),
                  expect.objectContaining({ subfield: 'd', value: '24 cm' }),
                ],
              }),
            }),
          ],
        }),
      }),
    });
    expect(tx.externalIdentifier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'organization-1',
      }),
    });
    expect(result.id).toBe('work-1');
  });

  it('ignores scalar publication values when statements exist without projections', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input: CatalogueImportDto = {
      ...baseInput,
      edition: {
        ...baseInput.edition,
        publisher: 'Legacy publisher',
        publicationDate: '2022',
        publicationStatements: [
          {
            sortOrder: 0,
            parts: [
              { subfield: 'b', value: 'Additional information', sortOrder: 0 },
            ],
          },
        ],
      },
    };

    await service.import('jwt-user-1', input);

    expect(tx.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publisher: null,
        publicationDate: null,
        publicationPlace: null,
      }),
    });
  });

  it('rejects a duplicate ISBN belonging to the same user', async () => {
    const { tx } = createTransactionMock();
    tx.edition.findFirst.mockResolvedValue({ id: 'existing-edition' });
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    await expect(service.import('jwt-user-1', baseInput)).rejects.toMatchObject(
      {
        status: 409,
        response: expect.objectContaining({
          code: 'CONFLICT_DUPLICATE_EDITION',
        }),
      },
    );
    expect(tx.work.create).not.toHaveBeenCalled();
  });

  it('allows the same ISBN in a different organization', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-b' }),
      } as never,
    );

    await expect(
      service.import('jwt-user-b', baseInput),
    ).resolves.toBeDefined();
    expect(tx.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'organization-b' }),
    });
    expect(tx.externalIdentifier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'organization-b' }),
    });
  });

  it('allows imports without ISBNs', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input = {
      ...baseInput,
      edition: { ...baseInput.edition, isbn10: null, isbn13: null },
      externalIdentifiers: [],
    };

    await expect(service.import('jwt-user-1', input)).resolves.toBeDefined();
    expect(tx.edition.findFirst).not.toHaveBeenCalled();
  });

  it('validates ISBNs before opening a transaction', async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input = {
      ...baseInput,
      edition: { ...baseInput.edition, isbn13: '9789724426496' },
    };

    await expect(service.import('jwt-user-1', input)).rejects.toThrow(
      'not a valid ISBN',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back when an internal creation fails', async () => {
    const { tx } = createTransactionMock();
    tx.item.create.mockRejectedValue(new Error('item failure'));
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    await expect(service.import('jwt-user-1', baseInput)).rejects.toThrow(
      'item failure',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not persist legacy contributor payloads when canonical contributions are absent', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    await service.import('jwt-user-1', baseInput);

    expect(tx.contributor.findMany).not.toHaveBeenCalled();
    expect(tx.contributor.create).not.toHaveBeenCalled();
    expect(tx.workContributor.create).not.toHaveBeenCalled();
    expect(tx.editionContributor.create).not.toHaveBeenCalled();
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('persists same-name PORBASE contributions as organization-scoped Agents in separate organizations', async () => {
    const input: CatalogueImportDto = {
      ...baseInput,
      contributions: [
        {
          targetScope: 'WORK',
          kind: 'PERSON',
          displayName: 'Jane Doe',
          sourceTag: '700',
          indicator1: '1',
          indicator2: ' ',
          sortOrder: 0,
          sourceParts: [
            { code: 'a', value: 'Doe, Jane', sortOrder: 0 },
            { code: '4', value: '070', sortOrder: 1 },
          ],
        },
      ],
    };
    const organizationIds = ['organization-a', 'organization-b'];
    const transactions = organizationIds.map((organizationId) =>
      createTransactionMock(organizationId),
    );
    const persistPolicy = {
      assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined),
    };
    const contributionsService = new ContributionsService(
      {} as never,
      persistPolicy as never,
    );

    for (const [index, organizationId] of organizationIds.entries()) {
      const tx = transactions[index].tx;
      const prisma = {
        $transaction: vi.fn(
          async (callback: (transaction: typeof tx) => unknown) => callback(tx),
        ),
      };
      const importService = new PorbaseImportService(
        prisma as never,
        {
          getDefaultOrganization: vi
            .fn()
            .mockResolvedValue({ id: organizationId }),
        } as never,
        contributionsService,
      );

      await importService.import(`user-${organizationId}`, input);

      expect(tx.agent.findMany).toHaveBeenCalledWith({
        where: {
          organizationId,
          kind: 'PERSON',
          normalizedDisplayName: 'jane doe',
        },
        take: 2,
        orderBy: { id: 'asc' },
      });
      expect(tx.agent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId }),
      });
      expect(tx.contribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentId: `agent-${organizationId}`,
            workId: 'work-1',
            source: 'PORBASE',
            sourceTag: '700',
          }),
        }),
      );
      expect(tx.contributor.findMany).not.toHaveBeenCalled();
      expect(tx.contributor.create).not.toHaveBeenCalled();
      expect(tx.workContributor.create).not.toHaveBeenCalled();
      expect(tx.editionContributor.create).not.toHaveBeenCalled();
    }

    expect(transactions[0].tx.contribution.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'agent-organization-b' }),
      }),
    );
    expect(transactions[1].tx.contribution.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'agent-organization-a' }),
      }),
    );
    expect(persistPolicy.assertWorkWriteAccess).toHaveBeenCalledTimes(2);
  });

  it('projects Work/Edition scalars from MAIN titles instead of the legacy scalar fields', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input: CatalogueImportDto = {
      ...baseInput,
      work: {
        ...baseInput.work,
        title: 'Legacy work title',
        titles: [
          { type: 'MAIN', value: 'Canonical work title', sortOrder: 0 },
          { type: 'VARIANT', value: 'Alternate title', sortOrder: 1 },
        ],
      },
      edition: {
        ...baseInput.edition,
        title: 'Legacy edition title',
        titles: [
          { type: 'MAIN', value: 'Canonical edition title', sortOrder: 0 },
        ],
      },
    };

    await service.import('jwt-user-1', input);

    expect(tx.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Canonical work title',
        titles: {
          create: [
            expect.objectContaining({
              type: 'MAIN',
              value: 'Canonical work title',
              source: 'PORBASE',
            }),
            expect.objectContaining({
              type: 'VARIANT',
              value: 'Alternate title',
            }),
          ],
        },
      }),
    });
    expect(tx.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Canonical edition title',
        titles: {
          create: [
            expect.objectContaining({
              type: 'MAIN',
              value: 'Canonical edition title',
            }),
          ],
        },
      }),
    });
  });

  it('projects Edition.language from the TEXT-role language instead of the legacy scalar', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input: CatalogueImportDto = {
      ...baseInput,
      edition: {
        ...baseInput.edition,
        language: 'eng',
        languages: [
          { code: 'por', role: 'TEXT', sortOrder: 0 },
          { code: 'gre', role: 'ORIGINAL_LANGUAGE', sortOrder: 1 },
        ],
      },
    };

    await service.import('jwt-user-1', input);

    expect(tx.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        language: 'por',
        languages: {
          create: [
            { code: 'por', role: 'TEXT', sortOrder: 0 },
            { code: 'gre', role: 'ORIGINAL_LANGUAGE', sortOrder: 1 },
          ],
        },
      }),
    });
  });

  it('persists responsibility statements, series, notes and classifications', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input: CatalogueImportDto = {
      ...baseInput,
      edition: {
        ...baseInput.edition,
        responsibilityStatements: [
          { label: 'STATEMENT', value: 'Pedro Braga', sortOrder: 0 },
        ],
        series: [
          {
            title: 'Viagens na ficção',
            parallelTitle: 'Journeys in fiction',
            volumeNumber: '1',
            issn: '0873-7627',
            sortOrder: 0,
          },
        ],
        notes: [{ type: 'SUMMARY', value: 'Resumo da obra', sortOrder: 0 }],
        classifications: [
          {
            notation: '821.134.3-3',
            system: 'UDC',
            systemEdition: 'BN',
            authorityId: '12345',
            sortOrder: 0,
          },
        ],
      },
    };

    await service.import('jwt-user-1', input);

    expect(tx.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        responsibilityStatements: {
          create: [
            expect.objectContaining({
              label: 'STATEMENT',
              value: 'Pedro Braga',
              source: 'PORBASE',
            }),
          ],
        },
        series: {
          create: [
            expect.objectContaining({
              title: 'Viagens na ficção',
              parallelTitle: 'Journeys in fiction',
              volumeNumber: '1',
              issn: '0873-7627',
              source: 'PORBASE',
            }),
          ],
        },
        notes: {
          create: [
            expect.objectContaining({
              type: 'SUMMARY',
              value: 'Resumo da obra',
              source: 'PORBASE',
            }),
          ],
        },
        classifications: {
          create: [
            expect.objectContaining({
              notation: '821.134.3-3',
              system: 'UDC',
              systemEdition: 'BN',
              authorityId: '12345',
              source: 'PORBASE',
            }),
          ],
        },
      }),
    });
  });

  it('persists a corporate contributor (710) through ContributionsService', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const persistPorbase = vi.fn().mockResolvedValue([]);
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
      { persistPorbase } as never,
    );
    const input: CatalogueImportDto = {
      ...baseInput,
      contributions: [
        {
          targetScope: 'WORK',
          kind: 'CORPORATE_BODY',
          displayName: 'Portugal. Ministério da Cultura',
          authorityId: 'corp-authority-1',
          sourceTag: '710',
          indicator1: ' ',
          indicator2: ' ',
          sortOrder: 0,
          sourceParts: [{ code: 'a', value: 'Portugal.', sortOrder: 0 }],
        },
      ],
    };

    await service.import('jwt-user-1', input);

    expect(persistPorbase).toHaveBeenCalledWith(
      tx,
      'jwt-user-1',
      'work-1',
      expect.arrayContaining([
        expect.objectContaining({
          sourceTag: '710',
          kind: 'CORPORATE_BODY',
          authorityId: 'corp-authority-1',
        }),
      ]),
    );
    expect(tx.contributor.create).not.toHaveBeenCalled();
  });

  it('persists repeated 205 statements without collapsing their order or kinds', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    await service.import('jwt-user-1', {
      ...baseInput,
      edition: {
        ...baseInput.edition,
        titles: [
          {
            type: 'MAIN',
            value: 'Canonical title',
            subtitle: 'Canonical subtitle',
            sortOrder: 0,
          },
        ],
        languages: [{ code: 'por', role: 'TEXT', sortOrder: 0 }],
        editionStatements: [
          {
            value: '2.ª ed.',
            kind: 'EDITION',
            label: null,
            sortOrder: 0,
            sourceTag: '205',
          },
          {
            value: 'revista',
            kind: 'OTHER',
            label: null,
            sortOrder: 1,
            sourceTag: '205',
          },
          {
            value: 'com prefácio',
            kind: 'RESPONSIBILITY',
            label: 'responsibility',
            sortOrder: 2,
            sourceTag: '205',
          },
        ],
      },
    });

    expect(tx.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Canonical title',
        subtitle: 'Canonical subtitle',
        editionStatements: {
          create: [
            expect.objectContaining({ value: '2.ª ed.', sortOrder: 0 }),
            expect.objectContaining({ value: 'revista', sortOrder: 1 }),
            expect.objectContaining({
              value: 'com prefácio',
              kind: 'RESPONSIBILITY',
              label: 'responsibility',
              sortOrder: 2,
            }),
          ],
        },
      }),
    });
  });

  it('passes authority identifiers for personal and corporate contributions', async () => {
    const { tx } = createTransactionMock();
    const persistPorbase = vi.fn().mockResolvedValue([]);
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
      { persistPorbase } as never,
    );

    await service.import('jwt-user-1', {
      ...baseInput,
      contributions: [
        {
          targetScope: 'WORK',
          kind: 'PERSON',
          displayName: 'Jane Doe',
          authorityId: 'person-authority-1',
          sourceTag: '700',
          indicator1: '1',
          indicator2: ' ',
          sortOrder: 0,
          sourceParts: [{ code: 'a', value: 'Doe, Jane', sortOrder: 0 }],
        },
        {
          targetScope: 'WORK',
          kind: 'CORPORATE_BODY',
          displayName: 'Portugal. Ministério da Cultura',
          authorityId: 'corp-authority-1',
          sourceTag: '710',
          indicator1: '2',
          indicator2: ' ',
          sortOrder: 1,
          sourceParts: [{ code: 'a', value: 'Portugal.', sortOrder: 0 }],
        },
      ],
    });

    expect(persistPorbase).toHaveBeenCalledWith(
      tx,
      'jwt-user-1',
      'work-1',
      expect.arrayContaining([
        expect.objectContaining({
          sourceTag: '700',
          authorityId: 'person-authority-1',
        }),
        expect.objectContaining({
          sourceTag: '710',
          authorityId: 'corp-authority-1',
        }),
      ]),
    );
  });

  it('re-derives unmapped/local fields from rawContent instead of trusting client-supplied provenance', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const input: CatalogueImportDto = {
      ...baseInput,
      bibliographicRecord: {
        format: 'MARC_TEXT',
        remoteId: 'record-1',
        rawContent: ['200 $a Título', '966 $l BN $s CT. 123 V.'].join('\n'),
      },
    };

    await service.import('jwt-user-1', input);

    expect(tx.bibliographicRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unmappedSourceFields: {
            create: expect.arrayContaining([
              expect.objectContaining({
                tag: '966',
                reason: 'LOCAL',
                subfields: {
                  create: expect.arrayContaining([
                    expect.objectContaining({ code: 'l', value: 'BN' }),
                    expect.objectContaining({
                      code: 's',
                      value: 'CT. 123 V.',
                    }),
                  ]),
                },
              }),
            ]),
          },
        }),
      }),
    );
  });

  it('never trusts client-supplied source/sourceId provenance or writes a removed schema field', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const forgedInput = {
      ...baseInput,
      bibliographicRecord: {
        ...baseInput.bibliographicRecord,
        // A malicious/legacy client attempting to forge provenance.
        source: 'FORGED_SOURCE',
        schema: 'FORGED_SCHEMA',
        sourceId: 'forged-provider',
      },
    } as unknown as CatalogueImportDto;

    await service.import('jwt-user-1', forgedInput, 'porbase');

    expect(tx.bibliographicRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'PORBASE',
          sourceId: 'porbase',
        }),
      }),
    );
    const createData = tx.bibliographicRecord.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('schema');
  });

  it('extracts and upserts 856 cover candidates inside the import transaction', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );
    const rawContent = [
      '200 $a Edition title',
      '856 40 $uhttps://covers.example.org/cover.jpg $qimage/jpeg $yCover $zFront cover',
      '856 40 $uhttps://covers.example.org/cover.jpg $qimage/jpeg',
      '856 40 $uhttps://example.org/catalogue/record-1 $qtext/html',
    ].join('\n');

    await service.import('jwt-user-1', {
      ...baseInput,
      bibliographicRecord: { ...baseInput.bibliographicRecord, rawContent },
    });

    expect(tx.bibliographicRecord.create).toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SAVEPOINT cover_candidate_extraction',
    );
    expect(tx.coverCandidate.upsert).toHaveBeenCalledTimes(3);
    expect(tx.coverCandidate.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          bibliographicRecordId_urlHash: expect.objectContaining({
            bibliographicRecordId: 'record-1',
            urlHash: expect.any(String),
          }),
        },
        create: expect.objectContaining({
          bibliographicRecordId: 'record-1',
          url: 'https://covers.example.org/cover.jpg',
          sourceType: 'PORBASE',
          mimeType: 'image/jpeg',
          status: 'PENDING',
          rejectReason: null,
        }),
        update: {},
      }),
    );
    expect(tx.coverCandidate.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          url: 'https://covers.example.org/cover.jpg',
          status: 'PENDING',
        }),
      }),
    );
    const firstUrlHash =
      tx.coverCandidate.upsert.mock.calls[0][0].where
        .bibliographicRecordId_urlHash.urlHash;
    const duplicateUrlHash =
      tx.coverCandidate.upsert.mock.calls[1][0].where
        .bibliographicRecordId_urlHash.urlHash;
    expect(duplicateUrlHash).toBe(firstUrlHash);
    expect(tx.coverCandidate.upsert).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        create: expect.objectContaining({
          url: 'https://example.org/catalogue/record-1',
          status: 'REJECTED',
          rejectReason: 'NOT_IMAGE_LINK',
        }),
      }),
    );
    expect(tx.$executeRawUnsafe).toHaveBeenLastCalledWith(
      'RELEASE SAVEPOINT cover_candidate_extraction',
    );
  });

  it('continues import and rolls back candidate upserts when candidate persistence fails', async () => {
    const { tx } = createTransactionMock();
    tx.coverCandidate.upsert.mockRejectedValue(new Error('database failure'));
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    await expect(
      service.import('jwt-user-1', {
        ...baseInput,
        bibliographicRecord: {
          ...baseInput.bibliographicRecord,
          rawContent:
            '856 40 $uhttps://covers.example.org/cover.jpg $qimage/jpeg',
        },
      }),
    ).resolves.toBeDefined();

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'ROLLBACK TO SAVEPOINT cover_candidate_extraction',
    );
    expect(tx.item.create).toHaveBeenCalled();
  });

  it('attributes the persisted record to the provider id supplied by the caller, not the client', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(
      prisma as never,
      {
        getDefaultOrganization: vi
          .fn()
          .mockResolvedValue({ id: 'organization-1' }),
      } as never,
    );

    await service.import('jwt-user-1', baseInput, 'porbase');

    expect(tx.bibliographicRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceId: 'porbase' }),
      }),
    );
  });
});
