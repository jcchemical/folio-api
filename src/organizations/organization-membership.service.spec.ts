import { OrganizationRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from './organization-membership.service.js';

const userId = 'user-1';
const organizationId = 'organization-1';

function createService(overrides: Record<string, unknown> = {}) {
  const transaction = {
    organization: {
      create: vi.fn().mockResolvedValue({ id: organizationId }),
    },
    organizationMembership: {
      create: vi.fn().mockResolvedValue({ id: 'membership-1' }),
    },
  };
  const prisma = {
    organizationMembership: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: organizationId }),
    },
    organization: {
      create: vi.fn().mockResolvedValue({ id: organizationId }),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
    ...overrides,
  } as unknown as PrismaService;

  return { prisma, transaction, service: new OrganizationMembershipService(prisma) };
}

describe('OrganizationMembershipService', () => {
  it('provisions one personal organization with OWNER membership', async () => {
    const { transaction, service } = createService();

    const organization = await service.provisionPersonalOrganization(
      userId,
      'user@example.com',
    );

    expect(organization.id).toBe(organizationId);
    expect(transaction.organization.create).toHaveBeenCalledWith({
      data: { name: 'Biblioteca de user@example.com' },
    });
    expect(transaction.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        userId,
        organizationId,
        role: OrganizationRole.OWNER,
      },
    });
  });

  it('does not create a duplicate personal organization', async () => {
    const existing = { id: organizationId, name: 'Biblioteca pessoal' };
    const { prisma, service } = createService({
      organizationMembership: {
        findFirst: vi.fn().mockResolvedValue({ organization: existing }),
        create: vi.fn(),
      },
    });

    await expect(
      service.provisionPersonalOrganization(userId, 'user@example.com'),
    ).resolves.toEqual(existing);
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('allows a member to read an organization work', async () => {
    const { service } = createService({
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: OrganizationRole.READER,
          organization: { id: organizationId },
        }),
      },
    });

    await expect(
      service.assertWorkAccess(userId, {
        userId: 'other-user',
        organizationId,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a non-member and prevents READER writes', async () => {
    const { service } = createService({
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.assertWorkAccess(userId, {
        userId: 'other-user',
        organizationId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const readerService = createService({
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: OrganizationRole.READER,
          organization: { id: organizationId },
        }),
      },
    }).service;
    await expect(
      readerService.assertWorkWriteAccess(userId, {
        userId: 'other-user',
        organizationId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows STAFF and OWNER to write organization works', async () => {
    for (const role of [
      OrganizationRole.STAFF,
      OrganizationRole.ADMIN,
      OrganizationRole.OWNER,
    ]) {
      const { service } = createService({
        organizationMembership: {
          findUnique: vi.fn().mockResolvedValue({
            role,
            organization: { id: organizationId },
          }),
        },
      });

      await expect(
        service.assertWorkWriteAccess(userId, {
          userId: 'other-user',
          organizationId,
        }),
      ).resolves.toBeUndefined();
    }
  });

  it('uses userId fallback for legacy works without organizationId', async () => {
    const { service } = createService();

    await expect(
      service.assertWorkAccess(userId, { userId, organizationId: null }),
    ).resolves.toBeUndefined();
    await expect(
      service.assertWorkAccess('other-user', {
        userId,
        organizationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the migration deterministic and free of sensitive field updates', () => {
    const migration = readFileSync(
      'prisma/migrations/20260906170000_add_organizations_and_memberships/migration.sql',
      'utf8',
    );

    expect(migration).toContain("'org_personal_' || md5(u.\"id\")");
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(migration).not.toContain('passwordHash');
    expect(migration).not.toContain('refreshToken');
    expect(migration).not.toContain('rawContent');
  });
});
