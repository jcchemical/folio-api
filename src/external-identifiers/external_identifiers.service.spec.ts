import { HttpStatus } from '@nestjs/common';
import { OrganizationRole, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import {
  ExternalIdentifiersService,
  type ExternalIdentifierEntityType,
} from './external_identifiers.service.js';

const orgA = 'caaaaaaaaaaaaaaaaaaaaaaaa';
const orgB = 'cbbbbbbbbbbbbbbbbbbbbbbbb';
const identifier = {
  id: 'c111111111111111111111111',
  entityType: 'Work',
  entityId: 'c222222222222222222222222',
  authority: 'isbn-13',
  value: '9780000000001',
  organizationId: orgA,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function createService() {
  const prisma = {
    work: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: orgA }),
    },
    edition: {
      findUnique: vi.fn().mockResolvedValue({ work: { organizationId: orgA } }),
    },
    library: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: orgA }),
    },
    location: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ library: { organizationId: orgA } }),
    },
    holding: {
      findUnique: vi.fn().mockResolvedValue({
        edition: { work: { organizationId: orgA } },
        location: { library: { organizationId: orgA } },
      }),
    },
    item: {
      findUnique: vi.fn().mockResolvedValue({
        holding: {
          edition: { work: { organizationId: orgA } },
          location: { library: { organizationId: orgA } },
        },
      }),
    },
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
      organizationId: orgA,
    }),
    resolveDerivedResourceContext: vi.fn().mockResolvedValue({
      organizationId: orgA,
      role: OrganizationRole.STAFF,
    }),
    resolveDerivedParentPairContext: vi.fn().mockResolvedValue({
      first: { organizationId: orgA, role: OrganizationRole.STAFF },
      second: { organizationId: orgA, role: OrganizationRole.STAFF },
    }),
    requireRole: vi.fn(),
  } as unknown as OrganizationContextResolver;
  return {
    prisma,
    contexts,
    service: new ExternalIdentifiersService(prisma, contexts),
  };
}

describe('ExternalIdentifiersService organization context', () => {
  it('creates identifiers for each supported canonical entity and derives ownership', async () => {
    const { prisma, service } = createService();
    const types: ExternalIdentifierEntityType[] = [
      'Work',
      'Edition',
      'Library',
      'Location',
      'Holding',
      'Item',
    ];

    for (const entityType of types) {
      await service.create('user-a', {
        entityType,
        entityId: `entity-${entityType}`,
        authority: 'isbn-13',
        value: `value-${entityType}`,
      });
    }

    expect(prisma.externalIdentifier.create).toHaveBeenCalledTimes(
      types.length,
    );
    expect(prisma.externalIdentifier.create).toHaveBeenCalledWith({
      data: {
        entityType: 'Work',
        entityId: 'entity-Work',
        authority: 'isbn-13',
        value: 'value-Work',
        organizationId: orgA,
      },
    });
    expect(prisma.holding.findUnique).toHaveBeenCalled();
    expect(prisma.item.findUnique).toHaveBeenCalled();
  });

  it('requires root context, applies supported filters, and paginates', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(prisma.externalIdentifier.findMany).mockResolvedValue([
      identifier,
      { ...identifier, id: 'c333333333333333333333333' },
      { ...identifier, id: 'c444444444444444444444444' },
    ] as never);

    const page = await service.list('user-a', orgA, {
      entityType: 'Edition',
      entityId: 'edition-a',
      authority: 'oclc',
      cursor: 'c000000000000000000000000',
      limit: 2,
    });

    expect(contexts.resolveRequiredRootContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: orgA,
    });
    expect(prisma.externalIdentifier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: orgA,
          entityType: 'Edition',
          entityId: 'edition-a',
          authority: 'oclc',
        },
        take: 3,
        cursor: { id: 'c000000000000000000000000' },
        skip: 1,
      }),
    );
    expect(page).toMatchObject({
      items: [identifier, { id: 'c333333333333333333333333' }],
      nextCursor: 'c333333333333333333333333',
      hasMore: true,
    });
  });

  it('fetches by ID, updates only supplied fields, and deletes after STAFF authorization', async () => {
    const { prisma, contexts, service } = createService();

    await expect(service.findById(identifier.id, 'user-a')).resolves.toEqual(
      identifier,
    );
    await service.update(identifier.id, 'user-a', { value: 'updated-value' });
    await service.remove(identifier.id, 'user-a');

    expect(prisma.externalIdentifier.update).toHaveBeenCalledWith({
      where: { id: identifier.id },
      data: { value: 'updated-value' },
    });
    expect(prisma.externalIdentifier.delete).toHaveBeenCalledWith({
      where: { id: identifier.id },
    });
    expect(contexts.resolveDerivedResourceContext).toHaveBeenNthCalledWith(2, {
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: orgA,
      requiredRole: OrganizationRole.STAFF,
    });
  });

  it.each([
    ['ORGANIZATION_CONTEXT_REQUIRED', undefined],
    ['ORGANIZATION_ID_INVALID', 'not-an-org'],
    ['ORGANIZATION_NOT_FOUND', 'czzzzzzzzzzzzzzzzzzzzzzzz'],
    ['ORGANIZATION_MEMBERSHIP_REQUIRED', orgA],
  ])('preserves root context error %s', async (code, header) => {
    const { prisma, contexts, service } = createService();
    vi.mocked(contexts.resolveRequiredRootContext).mockRejectedValueOnce({
      status: HttpStatus.FORBIDDEN,
      response: { code },
    });

    await expect(service.list('user-b', header)).rejects.toMatchObject({
      response: { code },
    });
    expect(prisma.externalIdentifier.findMany).not.toHaveBeenCalled();
  });

  it('denies Reader writes and permits STAFF writes', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedResourceContext).mockRejectedValueOnce({
      status: HttpStatus.FORBIDDEN,
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });

    await expect(
      service.create('reader', {
        entityType: 'Work',
        entityId: 'work-a',
        authority: 'oclc',
        value: '123',
      }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(prisma.externalIdentifier.create).not.toHaveBeenCalled();

    await service.create('staff', {
      entityType: 'Work',
      entityId: 'work-a',
      authority: 'oclc',
      value: '123',
    });
    expect(prisma.externalIdentifier.create).toHaveBeenCalledTimes(1);
  });

  it('masks cross-Organization entity access and avoids mutation', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(prisma.work.findUnique).mockResolvedValueOnce({
      organizationId: orgB,
    } as never);
    vi.mocked(contexts.resolveDerivedResourceContext).mockRejectedValueOnce({
      status: HttpStatus.NOT_FOUND,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });

    await expect(
      service.create(
        'user-b',
        {
          entityType: 'Work',
          entityId: 'work-in-org-b',
          authority: 'oclc',
          value: '123',
        },
        orgA,
      ),
    ).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(prisma.externalIdentifier.create).not.toHaveBeenCalled();
  });

  it('rejects a Holding whose parent entities belong to different Organizations', async () => {
    const { prisma, contexts, service } = createService();
    vi.mocked(prisma.holding.findUnique).mockResolvedValueOnce({
      edition: { work: { organizationId: orgA } },
      location: { library: { organizationId: orgB } },
    } as never);

    await expect(
      service.create('user-a', {
        entityType: 'Holding',
        entityId: 'holding-cross-org',
        authority: 'local',
        value: 'ref-1',
      }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(contexts.resolveDerivedParentPairContext).toHaveBeenCalled();
    expect(prisma.externalIdentifier.create).not.toHaveBeenCalled();
  });

  it('maps duplicate authority/value bindings to the stable conflict code', async () => {
    const { prisma, service } = createService();
    vi.mocked(prisma.externalIdentifier.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create('user-a', {
        entityType: 'Work',
        entityId: 'work-a',
        authority: 'oclc',
        value: 'same-value',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: 'CONFLICT_DUPLICATE_EXTERNAL_IDENTIFIER' },
    });
  });
});
