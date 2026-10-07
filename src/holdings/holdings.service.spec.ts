import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { HoldingsService } from './holdings.service.js';

const orgA = `c${'a'.repeat(24)}`;
const orgB = `c${'b'.repeat(24)}`;
const edition = { id: 'edition-a', work: { organizationId: orgA } };
const location = { id: 'location-a', library: { organizationId: orgA } };
const holding = {
  id: 'holding-a',
  edition,
  location,
  callNumber: 'QA76',
  notes: null,
  items: [],
};

function fixture() {
  const prisma = {
    holding: {
      findMany: vi.fn().mockResolvedValue([holding]),
      findUnique: vi.fn().mockResolvedValue(holding),
      create: vi.fn().mockResolvedValue(holding),
      update: vi.fn().mockResolvedValue(holding),
      delete: vi.fn().mockResolvedValue(holding),
    },
    edition: { findUnique: vi.fn().mockResolvedValue(edition) },
    location: { findUnique: vi.fn().mockResolvedValue(location) },
  } as unknown as PrismaService;
  const contexts = {
    resolveRequiredRootContext: vi
      .fn()
      .mockResolvedValue({ organizationId: orgA }),
    resolveDerivedContext: vi.fn().mockResolvedValue({
      organizationId: orgA,
      role: OrganizationRole.STAFF,
    }),
  } as unknown as OrganizationContextResolver;
  return { prisma, contexts, service: new HoldingsService(prisma, contexts) };
}

describe('HoldingsService organization context', () => {
  it('requires root context and restricts query filters to that organization', async () => {
    const { prisma, service } = fixture();

    await service.findAll('user-a', orgA, {
      limit: 25,
      editionId: edition.id,
      locationId: location.id,
    } as never);

    expect(prisma.holding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          edition: { work: { organizationId: orgA } },
          location: { library: { organizationId: orgA } },
          editionId: edition.id,
          locationId: location.id,
        },
      }),
    );
  });

  it('creates only from same-organization persisted Edition and Location parents without requiring a header', async () => {
    const { prisma, contexts, service } = fixture();

    await service.create('user-a', {
      editionId: edition.id,
      locationId: location.id,
      callNumber: 'QA76',
      notes: 'Stacks note',
    });

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: orgA,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(prisma.holding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          editionId: edition.id,
          locationId: location.id,
          callNumber: 'QA76',
          notes: 'Stacks note',
        },
      }),
    );
  });

  it('rejects cross-organization parent pairs before authorization or mutation', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(prisma.location.findUnique).mockResolvedValue({
      id: location.id,
      library: { organizationId: orgB },
    } as never);

    await expect(
      service.create('user-a', {
        editionId: edition.id,
        locationId: location.id,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(contexts.resolveDerivedContext).not.toHaveBeenCalled();
    expect(prisma.holding.create).not.toHaveBeenCalled();
  });

  it('rejects a mismatching optional header before create', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });

    await expect(
      service.create(
        'user-a',
        {
          editionId: edition.id,
          locationId: location.id,
        },
        orgB,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(prisma.holding.create).not.toHaveBeenCalled();
  });

  it('fails closed for a persisted Holding whose Edition and Location tenants disagree', async () => {
    const inconsistent = {
      ...holding,
      location: { id: location.id, library: { organizationId: orgB } },
    };
    const local = fixture();
    vi.mocked(local.prisma.holding.findUnique).mockResolvedValue(
      inconsistent as never,
    );

    await expect(
      local.service.findById(holding.id, 'user-a'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(local.contexts.resolveDerivedContext).not.toHaveBeenCalled();
  });

  it.each(['update', 'remove'] as const)(
    'blocks %s before mutation when persisted Holding parents disagree',
    async (operation) => {
      const local = fixture();
      vi.mocked(local.prisma.holding.findUnique).mockResolvedValue({
        ...holding,
        location: { id: location.id, library: { organizationId: orgB } },
      } as never);

      const result =
        operation === 'update'
          ? local.service.update(holding.id, 'user-a', { notes: 'No write' })
          : local.service.remove(holding.id, 'user-a');

      await expect(result).rejects.toMatchObject({
        status: 409,
        response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
      });
      expect(local.prisma.holding.update).not.toHaveBeenCalled();
      expect(local.prisma.holding.delete).not.toHaveBeenCalled();
      expect(local.contexts.resolveDerivedContext).not.toHaveBeenCalled();
    },
  );

  it('does not mutate when STAFF authorization fails', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 403,
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });

    await expect(
      service.update(holding.id, 'reader', { notes: 'denied' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(prisma.holding.update).not.toHaveBeenCalled();
  });
});
