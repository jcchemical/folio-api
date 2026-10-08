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
    resolveDerivedParentPairContext: vi.fn().mockResolvedValue({
      first: { organizationId: orgA, role: OrganizationRole.STAFF },
      second: { organizationId: orgA, role: OrganizationRole.STAFF },
    }),
    requireRole: vi.fn(),
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

    expect(contexts.resolveDerivedParentPairContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      firstOrganizationId: orgA,
      secondOrganizationId: orgA,
    });
    expect(contexts.requireRole).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgA }),
      OrganizationRole.STAFF,
    );
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

  it('checks both parent memberships before reporting a cross-organization pair', async () => {
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
    expect(contexts.resolveDerivedParentPairContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      firstOrganizationId: orgA,
      secondOrganizationId: orgB,
    });
    expect(prisma.holding.create).not.toHaveBeenCalled();
  });

  it('rejects a mismatching optional header before create', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.resolveDerivedParentPairContext).mockRejectedValueOnce({
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

  it.each(['edition', 'location'] as const)(
    'returns not found when the %s parent is missing',
    async (parent) => {
      const { prisma, service } = fixture();
      if (parent === 'edition') {
        vi.mocked(prisma.edition.findUnique).mockResolvedValue(null);
      } else {
        vi.mocked(prisma.location.findUnique).mockResolvedValue(null);
      }

      await expect(
        service.create('user-a', {
          editionId: edition.id,
          locationId: location.id,
        }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(prisma.holding.create).not.toHaveBeenCalled();
    },
  );

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
    expect(local.contexts.resolveDerivedParentPairContext).toHaveBeenCalled();
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
      expect(local.contexts.resolveDerivedParentPairContext).toHaveBeenCalled();
    },
  );

  it('does not mutate when STAFF authorization fails', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.requireRole).mockImplementationOnce(() => {
      throw {
        status: 403,
        response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
      };
    });

    await expect(
      service.update(holding.id, 'reader', { notes: 'denied' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(prisma.holding.update).not.toHaveBeenCalled();
  });

  it('does not mutate after either parent membership is masked', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.resolveDerivedParentPairContext).mockRejectedValue({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });

    await expect(
      service.create('outsider', {
        editionId: edition.id,
        locationId: location.id,
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    await expect(
      service.update(holding.id, 'outsider', { notes: 'Denied' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    await expect(service.remove(holding.id, 'outsider')).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(prisma.holding.create).not.toHaveBeenCalled();
    expect(prisma.holding.update).not.toHaveBeenCalled();
    expect(prisma.holding.delete).not.toHaveBeenCalled();
  });
});
