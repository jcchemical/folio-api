import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { WorksService } from './works.service.js';

function createWorkService(work: Record<string, unknown>) {
  const prisma = {
    work: {
      findUnique: vi.fn().mockResolvedValue(work),
      update: vi.fn().mockResolvedValue(work),
    },
    edition: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    item: { deleteMany: vi.fn() },
    bibliographicRecord: { deleteMany: vi.fn() },
  } as unknown as PrismaService;
  const memberships = {
    assertWorkAccess: vi.fn().mockResolvedValue(undefined),
    assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined),
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

  it('updates Work scalar fields without deleting or recreating Editions or their dependent data', async () => {
    const work = {
      id: 'work-1',
      organizationId: 'organization-1',
      title: 'Existing title',
      subtitle: null,
      organization: { id: 'organization-1' },
      editions: [],
    };
    const { service, prisma } = createWorkService(work);

    await service.update('work-1', 'staff-user', {
      title: 'Updated title',
      subtitle: 'Updated subtitle',
      editions: [{ title: 'Must not be processed' }],
      organizationId: 'another-organization',
    } as never);

    expect(prisma.work.update).toHaveBeenCalledWith({
      where: { id: 'work-1' },
      data: { title: 'Updated title', subtitle: 'Updated subtitle' },
    });
    expect(prisma.edition.deleteMany).not.toHaveBeenCalled();
    expect(prisma.edition.create).not.toHaveBeenCalled();
    expect(prisma.item.deleteMany).not.toHaveBeenCalled();
    expect(prisma.bibliographicRecord.deleteMany).not.toHaveBeenCalled();
  });
});

describe('WorksService Phase 1 canonical read model', () => {
  it('keeps the read-only fallback for historical WorkContributor records', async () => {
    const work = {
      id: 'work-legacy',
      organizationId: 'organization-1',
      title: 'Historical work',
      organization: { id: 'organization-1' },
      editions: [],
      contributions: [],
      workContributors: [
        {
          id: 'legacy-work-link',
          role: 'author',
          sortOrder: 2,
          contributor: { id: 'legacy-contributor', name: 'Historical Author' },
        },
      ],
    };
    const { service } = createWorkService(work);

    await expect(service.findById(work.id, 'member')).resolves.toMatchObject({
      contributions: [
        {
          id: 'legacy-work-link',
          scope: 'WORK',
          roleLabel: 'author',
          agent: {
            id: 'legacy-contributor',
            displayName: 'Historical Author',
          },
          sourceParts: [],
        },
      ],
    });
  });

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
