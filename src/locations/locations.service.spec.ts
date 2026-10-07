import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { LocationsService } from './locations.service.js';

const orgA = `c${'a'.repeat(24)}`;
const library = { id: 'library-a', organizationId: orgA };
const location = {
  id: 'location-a',
  libraryId: library.id,
  name: 'Stacks',
  library,
};

function fixture() {
  const prisma = {
    library: { findUnique: vi.fn().mockResolvedValue(library) },
    location: {
      findMany: vi.fn().mockResolvedValue([location]),
      findUnique: vi.fn().mockResolvedValue(location),
      create: vi.fn().mockResolvedValue(location),
      update: vi.fn().mockResolvedValue(location),
      delete: vi.fn().mockResolvedValue(location),
    },
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
  return { prisma, contexts, service: new LocationsService(prisma, contexts) };
}

describe('LocationsService organization context', () => {
  it('requires root context and filters Locations through Library organization ownership', async () => {
    const { prisma, service } = fixture();

    await service.findAll('user-a', orgA);

    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { library: { organizationId: orgA } },
      }),
    );
  });

  it('derives create organization from persisted libraryId without requiring a header', async () => {
    const { prisma, contexts, service } = fixture();

    await service.create('user-a', { libraryId: library.id, name: ' Stacks ' });

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: orgA,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(prisma.location.create).toHaveBeenCalledWith({
      data: { libraryId: library.id, name: 'Stacks' },
      include: { library: true },
    });
  });

  it('passes an optional consistency header to the shared resolver and does not create after conflict', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });

    await expect(
      service.create(
        'user-a',
        { libraryId: library.id, name: 'Stacks' },
        `c${'b'.repeat(24)}`,
      ),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(prisma.location.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown Library before mutation', async () => {
    const { prisma, service } = fixture();
    vi.mocked(prisma.library.findUnique).mockResolvedValue(null);

    await expect(
      service.create('user-a', {
        libraryId: 'missing-library',
        name: 'Stacks',
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(prisma.location.create).not.toHaveBeenCalled();
  });
});
