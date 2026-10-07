import { HttpStatus } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { BibliographicRecordsService } from './bibliographic_records.service.js';

const userId = 'user-1';
const organizationId = 'organization-1';
const work = { id: 'work-1', organizationId };
const edition = { id: 'edition-1', work };
const record = {
  id: 'record-1',
  editionId: edition.id,
  edition,
  rawContent: '<record />',
};

function createService(
  recordResult: object | null = record,
  editionResult: object | null = edition,
) {
  const prisma = {
    bibliographicRecord: {
      findUnique: vi.fn().mockResolvedValue(recordResult),
      findMany: vi.fn().mockResolvedValue([record]),
    },
    edition: {
      findUnique: vi.fn().mockResolvedValue(editionResult),
    },
  } as unknown as PrismaService;
  const contexts = {
    resolveDerivedContext: vi.fn().mockResolvedValue({
      organizationId,
      role: OrganizationRole.READER,
    }),
  } as unknown as OrganizationContextResolver;

  return {
    prisma,
    contexts,
    service: new BibliographicRecordsService(prisma, contexts),
  };
}

describe('BibliographicRecordsService.findOne', () => {
  it('derives organization through Edition → Work and checks membership', async () => {
    const { prisma, contexts, service } = createService();

    await expect(service.findOne(userId, record.id)).resolves.toEqual(record);
    expect(prisma.bibliographicRecord.findUnique).toHaveBeenCalledWith({
      where: { id: record.id },
      include: { edition: { include: { work: true } } },
    });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId,
      headerValue: undefined,
      derivedOrganizationId: organizationId,
    });
  });

  it('accepts a matching optional organization header', async () => {
    const { contexts, service } = createService();

    await service.findOne(userId, record.id, organizationId);

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId,
      headerValue: organizationId,
      derivedOrganizationId: organizationId,
    });
  });

  it('propagates a stable context conflict for a mismatching header', async () => {
    const { contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce(
      new ApiException(
        HttpStatus.CONFLICT,
        API_ERROR_CODES.ORGANIZATION_CONTEXT_CONFLICT,
        'The selected organization does not match the requested resource.',
      ),
    );

    await expect(
      service.findOne(userId, record.id, 'organization-2'),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: API_ERROR_CODES.ORGANIZATION_CONTEXT_CONFLICT },
    });
  });

  it('rejects a missing record or invalid persisted target with a stable 404', async () => {
    const missingRecord = createService(null);
    await expect(
      missingRecord.service.findOne(userId, record.id),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(missingRecord.contexts.resolveDerivedContext).not.toHaveBeenCalled();

    const missingTarget = createService({ ...record, edition: null });
    await expect(
      missingTarget.service.findOne(userId, record.id),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(missingTarget.contexts.resolveDerivedContext).not.toHaveBeenCalled();
  });
});

describe('BibliographicRecordsService.findByEdition', () => {
  it('returns records only after resolving access to the Edition Work', async () => {
    const { prisma, contexts, service } = createService();

    await expect(service.findByEdition(userId, edition.id)).resolves.toEqual([
      record,
    ]);
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId,
      headerValue: undefined,
      derivedOrganizationId: organizationId,
    });
    expect(prisma.bibliographicRecord.findMany).toHaveBeenCalledWith({
      where: { editionId: edition.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('does not query records after membership authorization fails', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce(
      new ApiException(
        HttpStatus.FORBIDDEN,
        API_ERROR_CODES.ORGANIZATION_MEMBERSHIP_REQUIRED,
        'You do not have access to this organization.',
      ),
    );

    await expect(
      service.findByEdition('external-user', edition.id),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: { code: API_ERROR_CODES.ORGANIZATION_MEMBERSHIP_REQUIRED },
    });
    expect(prisma.bibliographicRecord.findMany).not.toHaveBeenCalled();
  });

  it('returns a stable 404 when the Edition does not exist', async () => {
    const { contexts, service } = createService(record, null);

    await expect(
      service.findByEdition(userId, 'missing-edition'),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: API_ERROR_CODES.RESOURCE_NOT_FOUND },
    });
    expect(contexts.resolveDerivedContext).not.toHaveBeenCalled();
  });
});
