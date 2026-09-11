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

describe('WorksService Phase 1 canonical read model', () => {
  it('reads titles, responsibility statements, languages, series, notes and classifications ordered deterministically', async () => {
    const work = {
      id: 'work-1',
      organizationId: 'organization-1',
      title: 'Shared work',
      organization: { id: 'organization-1' },
      editions: [],
    };
    const { service, prisma } = createWorkService(work);

    await service.findById('work-1', 'member');

    const call = (
      prisma.work.findUnique as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0][0] as {
      include: {
        titles: { orderBy: unknown[] };
        editions: {
          include: {
            titles: { orderBy: unknown[] };
            responsibilityStatements: { orderBy: unknown[] };
            languages: { orderBy: unknown[] };
            series: { orderBy: unknown[] };
            notes: { orderBy: unknown[] };
            classifications: { orderBy: unknown[] };
          };
        };
      };
    };

    expect(call.include.titles.orderBy).toEqual([
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
    expect(call.include.editions.include.titles.orderBy).toEqual([
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
    expect(
      call.include.editions.include.responsibilityStatements.orderBy,
    ).toEqual([{ sortOrder: 'asc' }, { id: 'asc' }]);
    expect(call.include.editions.include.languages.orderBy).toEqual([
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
    expect(call.include.editions.include.series.orderBy).toEqual([
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
    expect(call.include.editions.include.notes.orderBy).toEqual([
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
    expect(call.include.editions.include.classifications.orderBy).toEqual([
      { sortOrder: 'asc' },
      { id: 'asc' },
    ]);
  });
});
