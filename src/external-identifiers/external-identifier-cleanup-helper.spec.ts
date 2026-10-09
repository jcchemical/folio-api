import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { deleteExternalIdentifiers } from './external-identifier-cleanup.js';

describe('deleteExternalIdentifiers', () => {
  it('deletes only identifiers for the supplied entity IDs', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = {
      externalIdentifier: { deleteMany },
    } as unknown as Prisma.TransactionClient;

    await deleteExternalIdentifiers(tx, 'Item', ['item-1', 'item-2']);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        entityType: 'Item',
        entityId: { in: ['item-1', 'item-2'] },
      },
    });
  });

  it('does not issue a deleteMany query for an empty descendant group', async () => {
    const deleteMany = vi.fn();
    const tx = {
      externalIdentifier: { deleteMany },
    } as unknown as Prisma.TransactionClient;

    await deleteExternalIdentifiers(tx, 'Edition', []);

    expect(deleteMany).not.toHaveBeenCalled();
  });
});
