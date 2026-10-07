import { ConflictException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { ExternalIdentifiersService } from './external_identifiers.service.js';

const organizationA = 'organization-a';
const organizationB = 'organization-b';
const editionA = { id: 'edition-a', work: { organizationId: organizationA } };
const editionB = { id: 'edition-b', work: { organizationId: organizationB } };
const identifier = {
  id: 'identifier-a',
  type: 'ISBN-13',
  value: '9789898236005',
  source: 'PORBASE',
  editionId: editionA.id,
  edition: editionA,
};

function createService() {
  const prisma = {
    edition: { findUnique: vi.fn().mockResolvedValue(editionA) },
    externalIdentifier: {
      findMany: vi.fn().mockResolvedValue([identifier]),
      findUnique: vi.fn().mockResolvedValue(identifier),
      create: vi.fn().mockResolvedValue(identifier),
      update: vi.fn().mockResolvedValue(identifier),
      delete: vi.fn().mockResolvedValue(identifier),
    },
  } as unknown as PrismaService;
  const contexts = {
    resolveRequiredRootContext: vi.fn().mockResolvedValue({
      organizationId: organizationA,
    }),
    resolveDerivedContext: vi.fn().mockResolvedValue({
      organizationId: organizationA,
      role: OrganizationRole.STAFF,
    }),
  } as unknown as OrganizationContextResolver;
  return {
    prisma,
    contexts,
    service: new ExternalIdentifiersService(prisma, contexts),
  };
}

describe('ExternalIdentifiersService organization context', () => {
  it('requires explicit root context and filters to the selected organization', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(contexts.resolveRequiredRootContext).mockResolvedValueOnce({
      organizationId: organizationB,
    } as never);

    await service.findAll('user-a', organizationB);

    expect(contexts.resolveRequiredRootContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: organizationB,
    });
    expect(prisma.externalIdentifier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          edition: { work: { organizationId: organizationB } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('uses editionId only as a filter inside the selected organization', async () => {
    const { prisma, service } = createService();

    await service.findAll('user-a', organizationA, {
      limit: 25,
      editionId: editionA.id,
    });

    expect(prisma.externalIdentifier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          edition: { work: { organizationId: organizationA } },
          editionId: editionA.id,
        },
      }),
    );
  });

  it('derives child creation from persisted Edition and authorizes before mutation', async () => {
    const { prisma, contexts, service } = createService();

    await service.create(
      'user-a',
      { type: 'ISBN-13', value: '9789898236005', editionId: editionA.id },
      organizationA,
    );

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: organizationA,
      derivedOrganizationId: organizationA,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(prisma.externalIdentifier.create).toHaveBeenCalledWith({
      data: {
        type: 'ISBN-13',
        value: '9789898236005',
        source: undefined,
        editionId: editionA.id,
      },
    });
  });

  it('supports child creation without a header and rejects context mismatch before create', async () => {
    const { prisma, contexts, service } = createService();
    await service.create('user-a', {
      type: 'ISBN-13',
      value: '9789898236005',
      editionId: editionA.id,
    });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: organizationA,
      requiredRole: OrganizationRole.STAFF,
    });

    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    await expect(
      service.create(
        'user-a',
        { type: 'ISBN-13', value: 'same', editionId: editionA.id },
        organizationB,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(prisma.externalIdentifier.create).toHaveBeenCalledTimes(1);
  });

  it('derives detail, update, and delete authorization from the persisted identifier', async () => {
    const { prisma, contexts, service } = createService();

    await service.findById(identifier.id, 'user-a', organizationA);
    await service.update(identifier.id, 'user-a', { value: 'updated' });
    await service.remove(identifier.id, 'user-a', organizationA);

    expect(contexts.resolveDerivedContext).toHaveBeenNthCalledWith(1, {
      userId: 'user-a',
      headerValue: organizationA,
      derivedOrganizationId: organizationA,
    });
    expect(contexts.resolveDerivedContext).toHaveBeenNthCalledWith(2, {
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: organizationA,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(prisma.externalIdentifier.update).toHaveBeenCalledWith({
      where: { id: identifier.id },
      data: { value: 'updated' },
    });
    expect(prisma.externalIdentifier.delete).toHaveBeenCalledWith({
      where: { id: identifier.id },
    });
  });

  it('does not mutate after membership/role/conflict failures', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 403,
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    await expect(
      service.create('user-b', {
        type: 'ISBN-13',
        value: '9789898236005',
        editionId: editionA.id,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    expect(prisma.externalIdentifier.create).not.toHaveBeenCalled();

    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 403,
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    await expect(
      service.update(identifier.id, 'reader', { value: 'denied' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(prisma.externalIdentifier.update).not.toHaveBeenCalled();

    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    await expect(
      service.remove(identifier.id, 'user-a', organizationB),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(prisma.externalIdentifier.delete).not.toHaveBeenCalled();
  });

  it('returns RESOURCE_NOT_FOUND for missing Edition or identifier before mutation', async () => {
    const { prisma, service } = createService();
    vi.mocked(prisma.edition.findUnique).mockResolvedValue(null);
    await expect(
      service.create('user-a', {
        type: 'ISBN-13',
        value: '9789898236005',
        editionId: 'missing-edition',
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    vi.mocked(prisma.externalIdentifier.findUnique).mockResolvedValue(null);
    await expect(
      service.findById('missing-identifier', 'user-a'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(prisma.externalIdentifier.create).not.toHaveBeenCalled();
  });

  it('maps same-Edition unique violations to 409', async () => {
    const { prisma, service } = createService();
    prisma.externalIdentifier.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create('user-a', {
        type: 'ISBN-13',
        value: '9789898236005',
        editionId: editionA.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
