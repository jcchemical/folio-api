import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { ExportsService } from './exports.service.js';

const editionId = `c${'a'.repeat(24)}`;
const organizationId = 'organization-1';
const ownerId = 'user-owner';
const edition = {
  id: editionId,
  titles: [
    {
      id: 'title-main',
      type: 'MAIN',
      value: 'Canonical title',
      subtitle: 'Canonical subtitle',
      sortOrder: 0,
    },
  ],
  responsibilityStatements: [],
  languages: [],
  editionStatements: [],
  series: [],
  notes: [],
  classifications: [],
  contributions: [],
  physicalDescriptions: [],
  publicationStatements: [],
  work: {
    title: 'Unprojected work title',
    organizationId,
    titles: [],
    notes: [],
    contributions: [],
  },
};

function createService(
  target: object | null = edition,
  record: object | null = { id: 'record-1' },
  allowed = true,
) {
  const prisma = {
    edition: {
      findUnique: vi.fn().mockResolvedValue(target),
    },
    bibliographicRecord: {
      findFirst: vi.fn().mockResolvedValue(record),
    },
    externalIdentifier: {
      findMany: vi.fn().mockResolvedValue([
        { authority: 'isbn-13', value: '9780000000000' },
        { authority: 'porbase', value: 'provider-only-id' },
      ]),
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
  it('serializes canonical Edition fields without reading raw Record content', async () => {
    const { prisma, service } = createService();

    const xml = await service.exportMarcXchange(editionId, ownerId);

    expect(xml).toContain('<record format="MARC21" type="bibliographic">');
    expect(xml).toContain('<datafield ind1="1" ind2="0" tag="245">');
    expect(xml).toContain('<subfield code="a">Canonical title</subfield>');
    expect(xml).toContain('<subfield code="b">Canonical subtitle</subfield>');
    expect(xml).toContain('<datafield ind1=" " ind2=" " tag="020">');
    expect(xml).toContain('<subfield code="a">9780000000000</subfield>');
    expect(xml).not.toContain('provider-only-id');
    expect(prisma.bibliographicRecord.findFirst).toHaveBeenCalledWith({
      where: {
        editionId,
        edition: { work: { organizationId } },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    expect(prisma.externalIdentifier.findMany).toHaveBeenCalledWith({
      where: {
        entityType: 'Edition',
        entityId: editionId,
        organizationId,
      },
      orderBy: [{ id: 'asc' }],
    });
  });

  it('returns RESOURCE_NOT_FOUND when the Edition does not exist', async () => {
    const { prisma, service } = createService(null);

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(prisma.bibliographicRecord.findFirst).not.toHaveBeenCalled();
  });

  it('returns RESOURCE_NOT_FOUND when the Edition has no Bibliographic Record', async () => {
    const { prisma, service } = createService(edition, null);

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(prisma.edition.findUnique).toHaveBeenCalledTimes(1);
  });

  it('does not query the Record when the caller has no membership', async () => {
    const { prisma, contexts, service } = createService(
      edition,
      { id: 'record-1' },
      false,
    );

    await expect(
      service.exportMarcXchange(editionId, ownerId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledTimes(2);
    expect(prisma.bibliographicRecord.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an organization header mismatch before querying the Record', async () => {
    const { prisma, contexts, service } = createService();
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
    expect(prisma.bibliographicRecord.findFirst).not.toHaveBeenCalled();
  });
});
