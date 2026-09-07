import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from './prisma/prisma.service.js';
import { WorksService } from './works/works.service.js';
import { EditionsService } from './editions/editions.service.js';
import { ItemsService } from './items/items.service.js';

const userId = 'user-1';
const organizationId = 'organization-1';

function prismaWith(model: Record<string, unknown>): PrismaService {
  return {
    [Object.keys(model)[0]]: Object.values(model)[0],
  } as unknown as PrismaService;
}

function membershipPolicy(allowed: boolean) {
  const access = allowed
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(new ForbiddenException());
  return {
    assertWorkAccess: access,
    assertOrganizationAccess: access,
  };
}

describe('organization resource access', () => {
  it('allows a member to access a work in their organization', async () => {
    const work = { id: 'work-1', organizationId, organization: {}, editions: [] };
    const service = new WorksService(
      prismaWith({ work: { findUnique: vi.fn().mockResolvedValue(work) } }),
      membershipPolicy(true) as never,
    );

    await expect(service.findById('work-1', userId)).resolves.toEqual(work);
  });

  it.each([
    [
      'work',
      () =>
        new WorksService(
          prismaWith({ work: { findUnique: vi.fn().mockResolvedValue(null) } }),
          membershipPolicy(true) as never,
        ).findById('work-1', userId),
    ],
    [
      'edition',
      () =>
        new EditionsService(
          prismaWith({ edition: { findUnique: vi.fn().mockResolvedValue(null) } }),
          membershipPolicy(true) as never,
        ).findById('edition-1', userId),
    ],
    [
      'item',
      () =>
        new ItemsService(
          prismaWith({ item: { findUnique: vi.fn().mockResolvedValue(null) } }),
          membershipPolicy(true) as never,
        ).findById('item-1', userId),
    ],
  ])('missing %s returns 404', async (_resource, action) => {
    await expect(action()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an external user from works, editions, and items', async () => {
    const work = { id: 'work-1', organizationId };

    await expect(
      new WorksService(
        prismaWith({ work: { findUnique: vi.fn().mockResolvedValue(work) } }),
        membershipPolicy(false) as never,
      ).findById('work-1', userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new EditionsService(
        prismaWith({
          edition: {
            findUnique: vi.fn().mockResolvedValue({ id: 'edition-1', work }),
          },
        }),
        membershipPolicy(false) as never,
      ).findById('edition-1', userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new ItemsService(
        prismaWith({
          item: {
            findUnique: vi.fn().mockResolvedValue({ id: 'item-1', organizationId }),
          },
        }),
        membershipPolicy(false) as never,
      ).findById('item-1', userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
