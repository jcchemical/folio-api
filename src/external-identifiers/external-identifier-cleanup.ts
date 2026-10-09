import type { Prisma } from '@prisma/client';

export type ExternalIdentifierEntityType =
  'Work' | 'Edition' | 'Library' | 'Location' | 'Holding' | 'Item';

export async function deleteExternalIdentifiers(
  tx: Prisma.TransactionClient,
  entityType: ExternalIdentifierEntityType,
  entityIds: readonly string[],
): Promise<void> {
  if (entityIds.length === 0) return;

  await tx.externalIdentifier.deleteMany({
    where: { entityType, entityId: { in: [...entityIds] } },
  });
}
