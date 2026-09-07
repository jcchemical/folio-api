import { XMLParser } from 'fast-xml-parser';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
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
    publishDate: new Date('2024-01-02T00:00:00.000Z'),
    language: 'por',
    country: null,
    format: null,
    pages: 320,
    workId: 'work-1',
    work: {
      id: 'work-1',
      title: 'Título da obra',
      organizationId: 'organization-1',
      workContributors: [
        {
          role: 'author',
          sortOrder: 0,
          contributor: { name: 'Autor Local' },
        },
      ],
    },
    editionContributors: [],
    externalIdentifiers: [],
    ...overrides,
  };
}

function createService(edition: unknown, allowed = true) {
  const prisma = {
    edition: {
      findUnique: vi.fn().mockResolvedValue(edition),
    },
  } as unknown as PrismaService;

  return {
    prisma,
    service: new ExportsService(prisma, {
      assertWorkAccess: allowed
        ? vi.fn().mockResolvedValue(undefined)
        : vi.fn().mockRejectedValue(new ForbiddenException()),
    } as never),
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
    const { service } = createService(null);

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 403 when the edition belongs to another user', async () => {
    const { service } = createService(createEdition(), false);

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
    const query = vi.mocked(prisma.edition.findUnique).mock.calls[0][0];

    expect(query).toEqual({
      where: { id: editionId },
      include: {
        work: {
          include: {
            workContributors: {
              include: { contributor: true },
            },
          },
        },
        editionContributors: {
          include: { contributor: true },
        },
        externalIdentifiers: true,
      },
    });
    expect(xml).not.toContain('original');
  });
});

describe('ExportsController', () => {
  it('returns XML with download headers', async () => {
    const exportMarcXchange = vi
      .fn()
      .mockResolvedValue('<collection />');
    const controller = new ExportsController({ exportMarcXchange } as never);
    const response = { setHeader: vi.fn() } as unknown as Response;
    const request = {
      user: {
        id: ownerId,
        email: 'owner@example.com',
        name: null,
        roles: [],
      } satisfies AuthenticatedUser,
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
    expect(exportMarcXchange).toHaveBeenCalledWith(editionId, ownerId);
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
