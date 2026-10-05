import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { ContributorsService } from './contributors.service.js';

const user = { id: 'legacy-contributor-user', email: 'member@example.test' };
const organizationA = { id: 'legacy-contributor-org-a', name: 'Org A' };
const organizationB = { id: 'legacy-contributor-org-b', name: 'Org B' };
const sharedContributor = {
  id: 'legacy-shared-contributor',
  name: 'Shared legacy name',
  variantNames: [],
  workContributors: [
    { id: 'link-a', work: { id: 'work-a', organizationId: organizationA.id } },
    { id: 'link-b', work: { id: 'work-b', organizationId: organizationB.id } },
  ],
  editionContributors: [],
};

function createFixture() {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    organization: {
      findUnique: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: string } }) =>
            [organizationA, organizationB].find(({ id }) => id === where.id) ??
            null,
        ),
    },
    organizationMembership: {
      findUnique: vi.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const key = where.userId_organizationId;
          if (key.userId !== user.id || key.organizationId !== organizationA.id)
            return null;
          return {
            userId: user.id,
            organizationId: organizationA.id,
            role: OrganizationRole.STAFF,
            user,
            organization: organizationA,
          };
        },
      ),
    },
    contributor: {
      findUnique: vi.fn().mockResolvedValue(sharedContributor),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaService;
  const memberships = new OrganizationMembershipService(prisma);
  return { prisma, service: new ContributorsService(prisma, memberships) };
}

describe('ContributorsService legacy cross-organization isolation', () => {
  it('does not expose a legacy Contributor shared with an organization the user cannot access', async () => {
    const { service } = createFixture();

    await expect(
      service.findById(sharedContributor.id, user.id),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_ALL_MEMBERSHIPS_REQUIRED',
      }),
    });
  });

  it('does not allow a member of only one linked organization to update a shared legacy Contributor', async () => {
    const { prisma, service } = createFixture();

    await expect(
      service.update(sharedContributor.id, user.id, { name: 'Changed name' }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_ALL_MEMBERSHIPS_REQUIRED',
      }),
    });
    expect(prisma.contributor.update).not.toHaveBeenCalled();
  });

  it('does not allow a member of only one linked organization to delete a shared legacy Contributor', async () => {
    const { prisma, service } = createFixture();

    await expect(
      service.remove(sharedContributor.id, user.id),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_ALL_MEMBERSHIPS_REQUIRED',
      }),
    });
    expect(prisma.contributor.delete).not.toHaveBeenCalled();
  });
});
