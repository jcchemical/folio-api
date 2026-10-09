import { describe, expect, it, vi } from 'vitest';
import { EditionsService } from '../editions/editions.service.js';
import { HoldingsService } from '../holdings/holdings.service.js';
import { ItemsService } from '../items/items.service.js';
import { LibrariesService } from '../libraries/libraries.service.js';
import { LocationsService } from '../locations/locations.service.js';
import type { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { WorksService } from '../works/works.service.js';

const organizationId = 'organization-1';
const id = 'entity-1';
const holding = {
  id,
  edition: { work: { organizationId } },
  location: { library: { organizationId } },
};

const cases = [
  {
    entityType: 'Work',
    model: 'work',
    row: { id, organizationId },
    build: (p: PrismaService, c: OrganizationContextResolver) =>
      new WorksService(p, c),
  },
  {
    entityType: 'Edition',
    model: 'edition',
    row: { id, work: { organizationId } },
    build: (p: PrismaService, c: OrganizationContextResolver) =>
      new EditionsService(p, c),
  },
  {
    entityType: 'Library',
    model: 'library',
    row: { id, organizationId },
    build: (p: PrismaService, c: OrganizationContextResolver) =>
      new LibrariesService(p, c),
  },
  {
    entityType: 'Location',
    model: 'location',
    row: { id, library: { organizationId } },
    build: (p: PrismaService, c: OrganizationContextResolver) =>
      new LocationsService(p, c),
  },
  {
    entityType: 'Holding',
    model: 'holding',
    row: holding,
    build: (p: PrismaService, c: OrganizationContextResolver) =>
      new HoldingsService(p, c),
  },
  {
    entityType: 'Item',
    model: 'item',
    row: { id, holding },
    build: (p: PrismaService, c: OrganizationContextResolver) =>
      new ItemsService(p, c),
  },
] as const;

function setup(
  model: string,
  row: object,
  overrides: {
    deleteMany?: unknown;
    delete?: unknown;
    editions?: { id: string }[];
    holdings?: { id: string }[];
    items?: { id: string }[];
    locations?: { id: string }[];
    authorizationFailure?: Error;
  } = {},
) {
  const calls: string[] = [];
  const deleteEntity = vi.fn(() => {
    calls.push(`${model}.delete`);
    return overrides.delete ?? Promise.resolve(row);
  });
  const tx = {
    externalIdentifier: {
      deleteMany: vi.fn(() => {
        calls.push('externalIdentifier.deleteMany');
        return overrides.deleteMany ?? Promise.resolve({ count: 2 });
      }),
    },
    edition: {
      delete: deleteEntity,
      findMany: vi.fn(() => {
        calls.push('edition.findMany');
        return Promise.resolve(overrides.editions ?? []);
      }),
    },
    holding: {
      delete: deleteEntity,
      findFirst: vi.fn(() => {
        calls.push('holding.findFirst');
        return Promise.resolve(overrides.holdings?.[0] ?? null);
      }),
      findMany: vi.fn(() => {
        calls.push('holding.findMany');
        return Promise.resolve(overrides.holdings ?? []);
      }),
    },
    item: {
      delete: deleteEntity,
      findMany: vi.fn(() => {
        calls.push('item.findMany');
        return Promise.resolve(overrides.items ?? []);
      }),
    },
    location: {
      delete: deleteEntity,
      findMany: vi.fn(() => {
        calls.push('location.findMany');
        return Promise.resolve(overrides.locations ?? []);
      }),
    },
    work: { delete: deleteEntity },
    library: { delete: deleteEntity },
  };
  const prisma = {
    [model]: {
      findUnique: vi.fn().mockResolvedValue(row),
      delete: vi.fn(),
    },
    externalIdentifier: { deleteMany: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const first = { organizationId };
  const resolveContext = overrides.authorizationFailure
    ? vi.fn().mockRejectedValue(overrides.authorizationFailure)
    : vi.fn().mockResolvedValue(first);
  const contexts = {
    resolveDerivedContext: resolveContext,
    resolveDerivedResourceContext: resolveContext,
    resolveDerivedParentPairContext: resolveContext,
    requireRole: vi.fn(),
  } as unknown as OrganizationContextResolver;
  return { prisma, contexts, tx, calls };
}

describe.each(cases)(
  'External Identifier cleanup on $entityType removal',
  ({ entityType, model, row, build }) => {
    it('deletes identifiers then the entity inside one transaction', async () => {
      const { prisma, contexts, tx, calls } = setup(model, row);
      const service = build(prisma, contexts) as {
        remove(id: string, userId: string): Promise<unknown>;
      };

      await expect(service.remove(id, 'user-1')).resolves.toEqual(row);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.externalIdentifier.deleteMany).toHaveBeenCalledWith({
        where: { entityType, entityId: { in: [id] } },
      });
      expect(calls.at(-1)).toBe(`${model}.delete`);
      expect(prisma.externalIdentifier.deleteMany).not.toHaveBeenCalled();
      expect(
        (prisma as unknown as Record<string, { delete: unknown }>)[model]
          .delete,
      ).not.toHaveBeenCalled();
    });

    it('does not delete the entity when identifier cleanup fails', async () => {
      const failure = new Error('cleanup failed');
      const { prisma, contexts, tx } = setup(model, row, {
        deleteMany: Promise.reject(failure),
      });
      const service = build(prisma, contexts) as {
        remove(id: string, userId: string): Promise<unknown>;
      };

      await expect(service.remove(id, 'user-1')).rejects.toBe(failure);
      expect(
        (tx as unknown as Record<string, { delete: unknown }>)[model].delete,
      ).not.toHaveBeenCalled();
    });

    it('propagates entity delete failure so the transaction rolls back', async () => {
      const failure = new Error('delete failed');
      const { prisma, contexts } = setup(model, row, {
        delete: Promise.reject(failure),
      });
      const service = build(prisma, contexts) as {
        remove(id: string, userId: string): Promise<unknown>;
      };

      await expect(service.remove(id, 'user-1')).rejects.toBe(failure);
    });

    it('does not start cleanup before authorization succeeds', async () => {
      const failure = new Error('authorization denied');
      const { prisma, contexts } = setup(model, row, {
        authorizationFailure: failure,
      });
      const service = build(prisma, contexts) as {
        remove(id: string, userId: string): Promise<unknown>;
      };

      await expect(service.remove(id, 'user-1')).rejects.toBe(failure);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  },
);

describe('External Identifier descendant cleanup', () => {
  it('cleans Work, Edition, Holding and Item identifiers before deleting Work', async () => {
    const { prisma, tx, calls } = setup(
      'work',
      { id },
      {
        editions: [{ id: 'edition-child' }],
        holdings: [{ id: 'holding-child' }],
        items: [{ id: 'item-child' }],
      },
    );
    const service = new WorksService(prisma, {
      resolveDerivedContext: vi.fn().mockResolvedValue({ organizationId }),
    } as unknown as OrganizationContextResolver);

    await service.remove(id, 'user-1');

    expect(tx.edition.findMany).toHaveBeenCalledWith({
      where: { workId: id },
      select: { id: true },
    });
    expect(tx.holding.findMany).toHaveBeenCalledWith({
      where: { editionId: { in: ['edition-child'] } },
      select: { id: true },
    });
    expect(tx.item.findMany).toHaveBeenCalledWith({
      where: { holdingId: { in: ['holding-child'] } },
      select: { id: true },
    });
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { entityType: 'Work', entityId: { in: [id] } },
    });
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { entityType: 'Edition', entityId: { in: ['edition-child'] } },
    });
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(3, {
      where: { entityType: 'Holding', entityId: { in: ['holding-child'] } },
    });
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(4, {
      where: { entityType: 'Item', entityId: { in: ['item-child'] } },
    });
    expect(calls).toEqual([
      'edition.findMany',
      'holding.findMany',
      'item.findMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'work.delete',
    ]);
  });

  it('cleans Edition descendants and skips empty child identifier groups', async () => {
    const { prisma, tx, calls } = setup(
      'edition',
      { id, work: { organizationId } },
      { holdings: [{ id: 'holding-child' }], items: [{ id: 'item-child' }] },
    );
    const service = new EditionsService(prisma, {
      resolveDerivedContext: vi.fn().mockResolvedValue({ organizationId }),
    } as unknown as OrganizationContextResolver);

    await service.remove(id, 'user-1');

    expect(tx.externalIdentifier.deleteMany).toHaveBeenCalledTimes(3);
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { entityType: 'Edition', entityId: { in: [id] } },
    });
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { entityType: 'Holding', entityId: { in: ['holding-child'] } },
    });
    expect(tx.externalIdentifier.deleteMany).toHaveBeenNthCalledWith(3, {
      where: { entityType: 'Item', entityId: { in: ['item-child'] } },
    });
    expect(calls).toEqual([
      'holding.findMany',
      'item.findMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'edition.delete',
    ]);
  });

  it('cleans Holding Item identifiers and Library Location identifiers', async () => {
    const holdingSetup = setup('holding', holding, {
      items: [{ id: 'item-child' }],
    });
    const holdingService = new HoldingsService(holdingSetup.prisma, {
      resolveDerivedParentPairContext: vi
        .fn()
        .mockResolvedValue({ first: { organizationId } }),
      resolveDerivedResourceContext: vi
        .fn()
        .mockResolvedValue({ organizationId }),
      requireRole: vi.fn(),
    } as unknown as OrganizationContextResolver);
    await holdingService.remove(id, 'user-1');
    expect(holdingSetup.calls).toEqual([
      'item.findMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'holding.delete',
    ]);
    expect(
      holdingSetup.tx.externalIdentifier.deleteMany,
    ).toHaveBeenNthCalledWith(2, {
      where: { entityType: 'Item', entityId: { in: ['item-child'] } },
    });

    const librarySetup = setup(
      'library',
      { id, organizationId },
      { locations: [{ id: 'location-child' }] },
    );
    const libraryService = new LibrariesService(librarySetup.prisma, {
      resolveDerivedResourceContext: vi
        .fn()
        .mockResolvedValue({ organizationId }),
    } as unknown as OrganizationContextResolver);
    await libraryService.remove(id, 'user-1');
    expect(librarySetup.calls).toEqual([
      'location.findMany',
      'externalIdentifier.deleteMany',
      'externalIdentifier.deleteMany',
      'library.delete',
    ]);
    expect(
      librarySetup.tx.externalIdentifier.deleteMany,
    ).toHaveBeenNthCalledWith(2, {
      where: { entityType: 'Location', entityId: { in: ['location-child'] } },
    });
  });

  it('preserves Location Restrict behavior before deleting any identifiers', async () => {
    const { prisma, tx, calls } = setup(
      'location',
      { id, library: { organizationId } },
      { holdings: [{ id: 'holding-reference' }] },
    );
    const service = new LocationsService(prisma, {
      resolveDerivedResourceContext: vi
        .fn()
        .mockResolvedValue({ organizationId }),
    } as unknown as OrganizationContextResolver);

    await expect(service.remove(id, 'user-1')).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT_FOREIGN_KEY_REFERENCE' },
    });
    expect(tx.externalIdentifier.deleteMany).not.toHaveBeenCalled();
    expect(tx.location.delete).not.toHaveBeenCalled();
    expect(calls).toEqual(['holding.findFirst']);
  });
});
