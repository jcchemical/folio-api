import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { WorksService } from './works.service.js';

function createWorkService(work: Record<string, unknown>) {
  const prisma = {
    work: {
      findUnique: vi.fn().mockResolvedValue(work),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(work),
    },
    edition: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    item: { deleteMany: vi.fn() },
    bibliographicRecord: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
  const contexts = {
    resolveRequiredRootContext: vi.fn().mockResolvedValue({
      organizationId: 'organization-1',
    }),
    resolveDerivedContext: vi.fn().mockResolvedValue({
      organizationId: 'organization-1',
    }),
  } as unknown as OrganizationContextResolver;

  return {
    prisma,
    contexts,
    service: new WorksService(prisma, contexts),
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
    const { service, contexts } = createWorkService(work);

    await expect(service.findById('work-1', 'member')).resolves.toEqual({
      ...work,
      contributions: [],
    });
    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'member',
      headerValue: undefined,
      derivedOrganizationId: 'organization-1',
    });
  });

  it('lists only the explicitly selected organization for a multi-membership user', async () => {
    const work = {
      id: 'work-1',
      organizationId: 'organization-1',
      title: 'Selected tenant work',
      organization: { id: 'organization-1' },
      editions: [],
    };
    const { service, prisma, contexts } = createWorkService(work);
    vi.mocked(prisma.work.findMany).mockResolvedValue([work] as never);

    await service.findAllByUser('member', 'organization-1');

    expect(contexts.resolveRequiredRootContext).toHaveBeenCalledWith({
      userId: 'member',
      headerValue: 'organization-1',
    });
    expect(prisma.work.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'organization-1' },
      }),
    );
  });

  it('does not create a Work when explicit root context is missing', async () => {
    const { service, prisma, contexts } = createWorkService({});
    vi.mocked(contexts.resolveRequiredRootContext).mockRejectedValueOnce({
      status: 400,
      response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
    });

    await expect(
      service.create('member', undefined, { title: 'No tenant' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
