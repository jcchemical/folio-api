import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationMembershipService } from './organization-membership.service.js';
import { OrganizationContextResolver } from './organization-context.resolver.js';

const organization = {
  id: 'organization-1',
  name: 'Biblioteca Original',
  defaultCatalogueSource: 'porbase',
  enabledCatalogueSources: ['porbase'],
  createdAt: new Date('2026-09-06T00:00:00.000Z'),
};

function createService() {
  const transaction = {
    organization: {
      create: vi.fn().mockResolvedValue(organization),
      update: vi.fn().mockResolvedValue({
        ...organization,
        name: 'Biblioteca Nova',
      }),
    },
    organizationMembership: {
      create: vi.fn().mockResolvedValue({
        role: OrganizationRole.OWNER,
      }),
    },
  };
  const prisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue(organization),
      update: vi.fn().mockResolvedValue({
        ...organization,
        name: 'Biblioteca Nova',
      }),
    },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  } as unknown as PrismaService;
  const memberships = {
    getMemberships: vi.fn().mockResolvedValue([]),
    requireMembership: vi.fn().mockResolvedValue({
      role: OrganizationRole.OWNER,
      organization,
    }),
    assertRole: vi.fn().mockResolvedValue(undefined),
  } as unknown as OrganizationMembershipService;
  const contexts = {
    resolveDerivedContext: vi.fn().mockResolvedValue({
      role: OrganizationRole.OWNER,
    }),
  } as unknown as OrganizationContextResolver;

  return {
    prisma,
    transaction,
    memberships,
    contexts,
    service: new OrganizationsService(prisma, contexts, memberships),
  };
}

describe('OrganizationsService', () => {
  it('lists only the authenticated user memberships', async () => {
    const memberships = {
      getMemberships: vi
        .fn()
        .mockResolvedValue([{ organization, role: OrganizationRole.READER }]),
    } as unknown as OrganizationMembershipService;
    const { prisma } = createService();
    const scoped = new OrganizationsService(
      prisma,
      {
        resolveDerivedContext: vi.fn(),
      } as unknown as OrganizationContextResolver,
      memberships,
    );

    await expect(scoped.findAllByUser('user-1')).resolves.toEqual([
      {
        id: organization.id,
        name: organization.name,
        defaultCatalogueSource: 'porbase',
        enabledCatalogueSources: ['porbase'],
        role: OrganizationRole.READER,
        createdAt: organization.createdAt,
      },
    ]);
    expect(memberships.getMemberships).toHaveBeenCalledWith('user-1');
  });

  it('creates an organization and OWNER membership in one transaction', async () => {
    const { prisma, transaction, service } = createService();

    await expect(
      service.create('user-1', { name: '  Biblioteca   Nova  ' }),
    ).resolves.toMatchObject({
      id: organization.id,
      name: organization.name,
      role: OrganizationRole.OWNER,
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.organization.create).toHaveBeenCalledWith({
      data: {
        name: 'Biblioteca Nova',
        defaultCatalogueSource: 'porbase',
        enabledCatalogueSources: ['porbase'],
      },
    });
    expect(transaction.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        organizationId: organization.id,
        role: OrganizationRole.OWNER,
      },
    });
  });

  it('rejects empty or whitespace-only names', async () => {
    const { service } = createService();

    await expect(service.create('user-1', { name: '   ' })).rejects.toThrow(
      'Organization name cannot be empty',
    );
  });

  it('allows a member to read and blocks a non-member', async () => {
    const { service, contexts } = createService();

    await expect(
      service.findOneByUser('user-1', organization.id),
    ).resolves.toMatchObject({ role: OrganizationRole.OWNER });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-1',
      headerValue: undefined,
      derivedOrganizationId: organization.id,
    });
    const denied = createService();
    vi.mocked(denied.contexts.resolveDerivedContext).mockRejectedValueOnce(
      new ForbiddenException('not a member'),
    );
    await expect(
      denied.service.findOneByUser('external-user', organization.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows ADMIN to rename but does not pass unknown fields to Prisma', async () => {
    const { transaction, service, contexts } = createService();

    await service.update('admin-user', organization.id, {
      name: '  Biblioteca Nova  ',
      // @ts-expect-error verifies that runtime mapping ignores unknown input fields
      userId: 'other-user',
    });

    expect(transaction.organization.update).toHaveBeenCalledWith({
      where: { id: organization.id },
      data: { name: 'Biblioteca Nova' },
    });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'admin-user',
      headerValue: undefined,
      derivedOrganizationId: organization.id,
      requiredRole: OrganizationRole.ADMIN,
    });
  });

  it('blocks READER updates and permits only OWNER to reach deletion policy', async () => {
    const { service, contexts } = createService();

    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce(
      new ForbiddenException('reader cannot update'),
    );
    await expect(
      service.update('reader-user', organization.id, { name: 'New name' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.remove('owner-user', organization.id),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'CONFLICT_ORGANIZATION_DELETE',
      }),
    });
    expect(contexts.resolveDerivedContext).toHaveBeenLastCalledWith({
      userId: 'owner-user',
      headerValue: undefined,
      derivedOrganizationId: organization.id,
      requiredRole: OrganizationRole.OWNER,
    });
  });

  it('returns 404 for an unknown organization', async () => {
    const { service, prisma } = createService();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

    await expect(
      service.findOneByUser('user-1', 'missing'),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'ORGANIZATION_NOT_FOUND' }),
    });
  });
});
