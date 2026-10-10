import {
  OrganizationRole,
  WorkItemSource,
  WorkItemStatus,
  type WorkItem,
} from '@prisma/client';
import { vi } from 'vitest';

export const workItemOrgA = `c${'a'.repeat(24)}`;
export const workItemOrgB = `c${'b'.repeat(24)}`;
export const identifiedWorkItemId = `c${'1'.repeat(24)}`;
export const foreignWorkItemId = `c${'2'.repeat(24)}`;

export function makeWorkItemsPrisma() {
  const now = new Date('2026-10-10T12:00:00Z');
  const rows = new Map<string, WorkItem>([
    [
      identifiedWorkItemId,
      {
        id: identifiedWorkItemId,
        organizationId: workItemOrgA,
        source: WorkItemSource.SCAN,
        rawValue: 'barcode-a',
        matchedItemId: `c${'3'.repeat(24)}`,
        status: WorkItemStatus.IDENTIFIED,
        createdById: 'staff',
        createdAt: now,
        updatedAt: now,
      },
    ],
    [
      foreignWorkItemId,
      {
        id: foreignWorkItemId,
        organizationId: workItemOrgB,
        source: WorkItemSource.MANUAL,
        rawValue: 'private-b',
        matchedItemId: null,
        status: WorkItemStatus.NEEDS_REVIEW,
        createdById: 'outsider',
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const memberships = [
    {
      userId: 'staff',
      organizationId: workItemOrgA,
      role: OrganizationRole.STAFF,
    },
    {
      userId: 'reader',
      organizationId: workItemOrgA,
      role: OrganizationRole.READER,
    },
    {
      userId: 'outsider',
      organizationId: workItemOrgB,
      role: OrganizationRole.STAFF,
    },
    {
      userId: 'owner',
      organizationId: workItemOrgA,
      role: OrganizationRole.OWNER,
    },
    {
      userId: 'admin',
      organizationId: workItemOrgA,
      role: OrganizationRole.ADMIN,
    },
    {
      userId: 'multi',
      organizationId: workItemOrgA,
      role: OrganizationRole.STAFF,
    },
    {
      userId: 'multi',
      organizationId: workItemOrgB,
      role: OrganizationRole.STAFF,
    },
  ];
  let sequence = 10;
  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        memberships.some((member) => member.userId === where.id)
          ? { id: where.id, email: `${where.id}@example.test`, name: where.id }
          : null,
      ),
    },
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        [workItemOrgA, workItemOrgB].includes(where.id)
          ? { id: where.id, name: where.id }
          : null,
      ),
    },
    organizationMembership: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const key = where.userId_organizationId;
          return (
            memberships.find(
              (member) =>
                member.userId === key.userId &&
                member.organizationId === key.organizationId,
            ) ?? null
          );
        },
      ),
    },
    workItem: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          rows.get(where.id) ?? null,
      ),
      findMany: vi.fn(
        async ({
          where,
          take,
          cursor,
          skip,
        }: {
          where: { organizationId: string; status?: WorkItemStatus };
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          const ordered = [...rows.values()].sort(
            (a, b) =>
              b.createdAt.getTime() - a.createdAt.getTime() ||
              b.id.localeCompare(a.id),
          );
          const start = cursor
            ? ordered.findIndex((row) => row.id === cursor.id) + (skip ?? 0)
            : 0;
          return ordered
            .slice(start)
            .filter(
              (row) =>
                row.organizationId === where.organizationId &&
                (!where.status || row.status === where.status),
            )
            .slice(0, take);
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Pick<
            WorkItem,
            'organizationId' | 'createdById' | 'source' | 'status' | 'rawValue'
          >;
        }) => {
          const id = `c${String(sequence++).padStart(24, '0')}`;
          const row: WorkItem = {
            ...data,
            id,
            matchedItemId: null,
            createdAt: now,
            updatedAt: now,
          };
          rows.set(id, row);
          return row;
        },
      ),
      updateManyAndReturn: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; organizationId: string; status: WorkItemStatus };
          data: { status: WorkItemStatus };
        }) => {
          const row = rows.get(where.id);
          if (
            !row ||
            row.organizationId !== where.organizationId ||
            row.status !== where.status
          )
            return [];
          const updated = { ...row, ...data, updatedAt: new Date() };
          rows.set(row.id, updated);
          return [updated];
        },
      ),
    },
  };
  return { prisma, rows };
}
