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
  overrides: { deleteMany?: unknown; delete?: unknown } = {},
) {
  const calls: string[] = [];
  const tx = {
    externalIdentifier: {
      deleteMany: vi.fn(() => {
        calls.push('externalIdentifier.deleteMany');
        return overrides.deleteMany ?? Promise.resolve({ count: 2 });
      }),
    },
    [model]: {
      delete: vi.fn(() => {
        calls.push(`${model}.delete`);
        return overrides.delete ?? Promise.resolve(row);
      }),
    },
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
  const contexts = {
    resolveDerivedContext: vi.fn().mockResolvedValue(first),
    resolveDerivedResourceContext: vi.fn().mockResolvedValue(first),
    resolveDerivedParentPairContext: vi.fn().mockResolvedValue({ first }),
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
        where: { entityType, entityId: id },
      });
      expect(calls).toEqual([
        'externalIdentifier.deleteMany',
        `${model}.delete`,
      ]);
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
  },
);
