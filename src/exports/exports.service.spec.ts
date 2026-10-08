import { XMLParser } from 'fast-xml-parser';
import {
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import * as unimarcLocalMapper from '../bibliography/mappers/unimarc-local.mapper.js';
import {
  EditionIdValidationPipe,
  ExportsController,
} from './exports.controller.js';
import { ExportsService } from './exports.service.js';

const ownerId = 'user-owner';
const editionId = `c${'a'.repeat(24)}`;

function createEdition(overrides: Record<string, unknown> = {}) {
  return {
    id: editionId,
    title: 'Título local corrigido',
    subtitle: 'Subtítulo local',
    isbn10: null,
    isbn13: '9789724426495',
    publisher: 'Editora Folio',
    publicationDate: '2024-01-02',
    language: 'por',
    country: null,
    format: null,
    pageCount: 320,
    workId: 'work-1',
    work: {
      id: 'work-1',
      title: 'Título da obra',
      organizationId: 'organization-1',
      contributions: [],
    },
    contributions: [],
    externalIdentifiers: [],
    physicalDescriptions: [],
    ...overrides,
  };
}

function createService(edition: unknown, allowed = true) {
  const organizationId =
    (edition as { work?: { organizationId?: string } } | null)?.work
      ?.organizationId ?? 'organization-1';
  const target = edition
    ? {
        id: (edition as { id: string }).id,
        work: { organizationId },
      }
    : null;
  const prisma = {
    edition: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(edition),
    },
    externalIdentifier: {
      findMany: vi.fn().mockResolvedValue(
        (
          edition as {
            externalIdentifiers?: { type: string; value: string }[];
          } | null
        )?.externalIdentifiers?.map(({ type, value }) => ({
          id: 'identifier-1',
          entityType: 'Edition',
          entityId: editionId,
          authority: type.toLowerCase(),
          value,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) ?? [],
      ),
    },
  } as unknown as PrismaService;
  const contexts = {
    resolveDerivedContext: allowed
      ? vi.fn().mockResolvedValue({ organizationId })
      : vi
          .fn()
          .mockRejectedValue(
            new ApiException(
              HttpStatus.FORBIDDEN,
              API_ERROR_CODES.ORGANIZATION_MEMBERSHIP_REQUIRED,
              'You do not have access to this organization.',
            ),
          ),
  } as unknown as OrganizationContextResolver;

  return {
    prisma,
    contexts,
    service: new ExportsService(prisma, contexts),
  };
}

describe('ExportsService', () => {
  it('exports a local edition as well-formed MARCXchange XML', async () => {
    const { service } = createService(createEdition());

    const xml = await service.exportMarcXchange(editionId, ownerId);
    const parsed = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: false,
    }).parse(xml);

    expect(parsed.collection.record['@_format']).toBe('Unimarc');
    expect(parsed.collection.record.controlfield).toEqual({
      '@_tag': '001',
      '#text': editionId,
    });
    expect(xml).toContain('Título local corrigido');
    expect(xml).not.toContain('rawContent');
  });

  it('returns 404 when the edition does not exist', async () => {
    const { prisma, service } = createService(null);

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(prisma.edition.findUnique).toHaveBeenCalledOnce();
  });

  it('returns RESOURCE_NOT_FOUND before loading the export graph for a non-member', async () => {
    const { prisma, contexts, service } = createService(createEdition(), false);

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: ownerId,
      headerValue: undefined,
      derivedOrganizationId: 'organization-1',
    });
    expect(prisma.edition.findUnique).toHaveBeenCalledOnce();
    expect(contexts.resolveDerivedContext).toHaveBeenCalledTimes(2);
  });

  it('rejects an organization header mismatch before loading the export graph', async () => {
    const { prisma, contexts, service } = createService(createEdition());
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce(
      new ApiException(
        HttpStatus.CONFLICT,
        API_ERROR_CODES.ORGANIZATION_CONTEXT_CONFLICT,
        'The selected organization does not match the requested resource.',
      ),
    );

    await expect(
      service.exportMarcXchange(editionId, ownerId, 'organization-2'),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: API_ERROR_CODES.ORGANIZATION_CONTEXT_CONFLICT },
    });
    expect(prisma.edition.findUnique).toHaveBeenCalledOnce();
  });

  it('returns 500 when local serialization fails', async () => {
    const { service } = createService(createEdition({ id: '' }));

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('does not query or use BibliographicRecord.rawContent', async () => {
    const { prisma, service } = createService(
      createEdition({ rawContent: '<record>original</record>' }),
    );

    const xml = await service.exportMarcXchange(editionId, ownerId);
    const [targetQuery, exportQuery] = vi
      .mocked(prisma.edition.findUnique)
      .mock.calls.map(([query]) => query);

    expect(targetQuery).toEqual({
      where: { id: editionId },
      select: { id: true, work: { select: { organizationId: true } } },
    });
    expect(exportQuery).toEqual(
      expect.objectContaining({
        where: { id: editionId, work: { organizationId: 'organization-1' } },
        include: expect.objectContaining({
          work: expect.objectContaining({
            include: expect.objectContaining({
              contributions: expect.any(Object),
            }),
          }),
          contributions: expect.any(Object),
        }),
      }),
    );
    expect(xml).not.toContain('original');
  });

  it('loads canonical export relations with deterministic ordering', async () => {
    const { prisma, service } = createService(createEdition());

    await service.exportMarcXchange(editionId, ownerId);

    const query = vi.mocked(prisma.edition.findUnique).mock.calls[1][0];
    const ordered = [{ sortOrder: 'asc' }, { id: 'asc' }];
    const include = query?.include as Record<string, unknown>;
    const work = include.work as { include: Record<string, unknown> };
    const workInclude = work.include;

    expect(query).toEqual(
      expect.objectContaining({
        where: { id: editionId, work: { organizationId: 'organization-1' } },
      }),
    );
    for (const relation of [
      'titles',
      'responsibilityStatements',
      'languages',
      'editionStatements',
      'series',
      'notes',
      'classifications',
    ]) {
      expect(include[relation]).toEqual({ orderBy: ordered });
    }
    expect(workInclude.titles).toEqual({ orderBy: ordered });
    expect(workInclude.notes).toEqual({ orderBy: ordered });
    expect(include.contributions).toEqual({
      orderBy: ordered,
      include: {
        agent: true,
        sourceParts: { orderBy: ordered },
      },
    });
    expect(workInclude.contributions).toEqual({
      orderBy: ordered,
      include: {
        agent: true,
        sourceParts: { orderBy: ordered },
      },
    });
    expect(prisma.externalIdentifier.findMany).toHaveBeenCalledWith({
      where: {
        entityType: 'Edition',
        entityId: editionId,
        organizationId: 'organization-1',
      },
      orderBy: [{ id: 'asc' }],
    });
    expect(include.physicalDescriptions).toEqual({
      orderBy: ordered,
      include: { parts: { orderBy: ordered } },
    });
    expect(include.publicationStatements).toEqual({
      orderBy: ordered,
      include: { parts: { orderBy: ordered } },
    });
  });

  it('passes canonical relations to the mapper while producing XML', async () => {
    const canonical = {
      titles: [{ type: 'MAIN', value: 'Canonical title', sortOrder: 0 }],
      responsibilityStatements: [{ label: 'STATEMENT', value: 'Statement' }],
      languages: [{ code: 'por', role: 'TEXT', sortOrder: 0 }],
      editionStatements: [
        { value: '2.ª ed.', kind: 'EDITION', sourceTag: '205' },
      ],
      series: [{ title: 'Série', volumeNumber: '1' }],
      notes: [{ type: 'GENERAL', value: 'Nota' }],
      classifications: [{ notation: '821.134.3', system: 'UDC' }],
      contributions: [
        {
          sortOrder: 0,
          sourceTag: '700',
          indicator1: '1',
          indicator2: ' ',
          sourceParts: [{ code: 'a', value: 'Canonical author', sortOrder: 0 }],
        },
      ],
      physicalDescriptions: [
        {
          sortOrder: 0,
          parts: [{ subfield: 'a', value: '100 p.', sortOrder: 0 }],
        },
      ],
      publicationStatements: [
        {
          sortOrder: 0,
          indicator1: ' ',
          indicator2: '9',
          parts: [
            { subfield: 'a', value: 'Lisboa', sortOrder: 0, groupIndex: 0 },
          ],
        },
      ],
      externalIdentifiers: [{ type: 'ISBN-13', value: '9789724426495' }],
    };
    const edition = createEdition({
      ...canonical,
      work: {
        ...createEdition().work,
        titles: [{ type: 'MAIN', value: 'Canonical work title', sortOrder: 0 }],
        notes: [{ type: 'GENERAL', value: 'Work note' }],
        contributions: [],
      },
    });
    const mapperSpy = vi.spyOn(unimarcLocalMapper, 'mapLocalEditionToUnimarc');
    const { service } = createService(edition);

    const xml = await service.exportMarcXchange(editionId, ownerId);
    const mapperInput = mapperSpy.mock.calls[0][0] as Record<string, unknown>;

    expect(xml).toContain('<collection');
    expect(mapperInput).toEqual(
      expect.objectContaining({
        id: editionId,
        ...canonical,
        legacyProjection: {
          edition: {
            title: 'Título local corrigido',
            subtitle: 'Subtítulo local',
            isbn10: null,
            isbn13: '9789724426495',
            publisher: 'Editora Folio',
            publicationDate: '2024-01-02',
            publicationPlace: undefined,
            language: 'por',
            pageCount: 320,
          },
          work: { title: 'Título da obra' },
        },
        work: expect.objectContaining({
          titles: [
            { type: 'MAIN', value: 'Canonical work title', sortOrder: 0 },
          ],
          notes: [{ type: 'GENERAL', value: 'Work note' }],
          contributions: [],
        }),
      }),
    );

    mapperSpy.mockRestore();
  });

  it('exports persisted physical descriptions and does not synthesize pages beside them', async () => {
    const { service } = createService(
      createEdition({
        pageCount: 999,
        physicalDescriptions: [
          {
            sortOrder: 0,
            parts: [
              { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
              { subfield: 'd', value: '24 cm', sortOrder: 1 },
            ],
          },
        ],
      }),
    );

    const xml = await service.exportMarcXchange(editionId, ownerId);

    expect(xml).toContain('146, [6] p.');
    expect(xml).toContain('24 cm');
    expect(xml).not.toContain('999 p.');
  });
});

describe('ExportsController', () => {
  it('returns XML with download headers', async () => {
    const exportMarcXchange = vi.fn().mockResolvedValue('<collection />');
    const controller = new ExportsController({ exportMarcXchange } as never);
    const response = { setHeader: vi.fn() } as unknown as Response;
    const request = {
      user: {
        id: ownerId,
        email: 'owner@example.com',
        name: null,
        roles: [],
      } satisfies AuthenticatedUser,
      headers: { [FOLIO_ORGANIZATION_HEADER]: 'organization-1' },
    } as never;

    const result = await controller.exportEdition(editionId, request, response);

    expect(result).toBe('<collection />');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/xml; charset=utf-8',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="folio-${editionId}.marcxchange.xml"`,
    );
    expect(exportMarcXchange).toHaveBeenCalledWith(
      editionId,
      ownerId,
      'organization-1',
    );
  });

  it('does not set download headers when export authorization fails', async () => {
    const exportMarcXchange = vi
      .fn()
      .mockRejectedValue(new Error('authorization failed'));
    const controller = new ExportsController({ exportMarcXchange } as never);
    const response = { setHeader: vi.fn() } as unknown as Response;
    const request = {
      user: { id: ownerId },
      headers: {},
    } as never;

    await expect(
      controller.exportEdition(editionId, request, response),
    ).rejects.toThrow('authorization failed');
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('rejects an invalid edition ID with 400', () => {
    const pipe = new EditionIdValidationPipe();

    expect(() => pipe.transform('not-an-edition-id', {})).toThrow(
      BadRequestException,
    );
  });

  it('accepts UUID and Prisma cuid edition IDs', () => {
    const pipe = new EditionIdValidationPipe();

    expect(pipe.transform('550e8400-e29b-41d4-a716-446655440000', {})).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(pipe.transform(editionId, {})).toBe(editionId);
  });
});
