import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { WorksService } from './works.service.js';

function createWorkService(work: Record<string, unknown>) {
  const prisma = {
    work: { findUnique: vi.fn().mockResolvedValue(work) },
  } as unknown as PrismaService;
  const memberships = {
    assertWorkAccess: vi.fn().mockResolvedValue(undefined),
    getOrganizations: vi.fn().mockResolvedValue([]),
  } as unknown as OrganizationMembershipService;

  return {
    prisma,
    memberships,
    service: new WorksService(prisma, memberships),
  };
}

describe('WorksService organization access', () => {
  it('allows a member to read a work through organizationId', async () => {
    const work = {
      id: 'work-1',
      organizationId: 'organization-1',
      title: 'Shared work',
      organization: { id: 'organization-1' },
      editions: [],
    };
    const { service, memberships } = createWorkService(work);

    await expect(service.findById('work-1', 'member')).resolves.toEqual({
      ...work,
      contributions: [],
    });
    expect(memberships.assertWorkAccess).toHaveBeenCalledWith('member', work);
  });
});
