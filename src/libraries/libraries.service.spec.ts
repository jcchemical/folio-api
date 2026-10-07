import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { LibrariesService } from './libraries.service.js';

const orgA = `c${'a'.repeat(24)}`;
const library = { id: 'library-a', name: 'Central', organizationId: orgA };

function fixture() {
  const prisma = {
    library: {
      findMany: vi.fn().mockResolvedValue([library]),
      findUnique: vi.fn().mockResolvedValue(library),
      create: vi.fn().mockResolvedValue(library),
      update: vi.fn().mockResolvedValue(library),
      delete: vi.fn().mockResolvedValue(library),
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
  return { prisma, contexts, service: new LibrariesService(prisma, contexts) };
}

describe('LibrariesService organization context', () => {
  it('requires root context and filters list results to the selected organization', async () => {
    const { prisma, contexts, service } = fixture();

    await service.findAll('user-a', orgA);

    expect(contexts.resolveRequiredRootContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: orgA,
    });
    expect(prisma.library.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: orgA } }),
    );
  });

  it('creates only in the header-selected organization and requires STAFF', async () => {
    const { prisma, contexts, service } = fixture();

    await service.create('user-a', orgA, { name: '  Central   Library ' });

    expect(contexts.resolveRequiredRootContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: orgA,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(prisma.library.create).toHaveBeenCalledWith({
      data: { organizationId: orgA, name: 'Central Library' },
    });
  });

  it('derives resource authorization from Library ownership and passes consistency headers', async () => {
    const { contexts, service } = fixture();

    await service.findById(library.id, 'user-a', orgA);

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: orgA,
      derivedOrganizationId: orgA,
    });
  });

  it('does not mutate when the resolver rejects a non-member or insufficient role', async () => {
    const { prisma, contexts, service } = fixture();
    vi.mocked(contexts.resolveRequiredRootContext).mockRejectedValueOnce({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });

    await expect(
      service.create('user-b', orgA, { name: 'Denied' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    expect(prisma.library.create).not.toHaveBeenCalled();
  });
});
