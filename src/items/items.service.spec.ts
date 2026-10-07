import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { ItemsService } from './items.service.js';

const userId = 'items-user-1';
const organizationId = 'items-org-1';
const holding = {
  id: 'holding-1',
  edition: { id: 'edition-1', work: { id: 'work-1', organizationId } },
  location: { id: 'location-1', library: { id: 'library-1', organizationId } },
};
const item = {
  id: 'item-1',
  holdingId: holding.id,
  holding,
  label: 'Reference copy',
  status: 'OWNED',
  notes: null,
};

function createFixture(role = OrganizationRole.STAFF, itemFound = true) {
  const prisma = {
    item: {
      findMany: vi.fn().mockResolvedValue([item]),
      findUnique: vi.fn().mockResolvedValue(itemFound ? item : null),
      create: vi.fn().mockResolvedValue(item),
      update: vi.fn().mockResolvedValue(item),
      delete: vi.fn().mockResolvedValue(item),
    },
    holding: {
      findUnique: vi.fn().mockResolvedValue(holding),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue({
        userId,
        organizationId,
        role,
        organization: { id: organizationId },
      }),
    },
  } as unknown as PrismaService;
  const service = new ItemsService(
    prisma,
    new OrganizationMembershipService(prisma),
  );
  return { prisma, service };
}

describe('ItemsService Holding ownership', () => {
  it('creates an Item from a persisted Holding without duplicating ownership or location', async () => {
    const { prisma, service } = createFixture();

    await service.create(userId, {
      holdingId: holding.id,
      label: 'Reference copy',
      status: 'OWNED',
      notes: 'Preserved copy',
    });

    expect(prisma.holding.findUnique).toHaveBeenCalledWith({
      where: { id: holding.id },
      include: {
        edition: { include: { work: true } },
        location: { include: { library: true } },
      },
    });
    expect(prisma.item.create).toHaveBeenCalledWith({
      data: {
        holdingId: holding.id,
        label: 'Reference copy',
        status: 'OWNED',
        notes: 'Preserved copy',
      },
    });
  });

  it('authorizes reads through Item → Holding → Edition → Work', async () => {
    const { prisma, service } = createFixture(OrganizationRole.READER);

    await expect(service.findById(item.id, userId)).resolves.toEqual(item);
    expect(prisma.item.findUnique).toHaveBeenCalledWith({
      where: { id: item.id },
      include: {
        holding: {
          include: {
            edition: { include: { work: true } },
            location: { include: { library: true } },
          },
        },
      },
    });
  });

  it('lists only items reachable through an organization membership', async () => {
    const { prisma, service } = createFixture();

    await service.findAllByUser(userId);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          holding: {
            edition: {
              work: { organization: { memberships: { some: { userId } } } },
            },
          },
        },
        include: {
          holding: {
            include: {
              edition: true,
              location: { include: { library: true } },
            },
          },
        },
      }),
    );
  });

  it('requires STAFF to create, update, or delete an Item', async () => {
    const { prisma, service } = createFixture(OrganizationRole.READER);

    await expect(
      service.create(userId, { holdingId: holding.id }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
      }),
    });
    await expect(
      service.update(item.id, userId, { label: 'No' }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
      }),
    });
    await expect(service.remove(item.id, userId)).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
      }),
    });
    expect(prisma.item.create).not.toHaveBeenCalled();
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(prisma.item.delete).not.toHaveBeenCalled();
  });

  it('updates only copy-level fields', async () => {
    const { prisma, service } = createFixture();

    await service.update(item.id, userId, {
      label: 'Updated',
      status: 'LOST',
      notes: 'Copy-level note',
    });

    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        label: 'Updated',
        status: 'LOST',
        notes: 'Copy-level note',
      },
    });
  });

  it('returns not found for missing Items or Holdings', async () => {
    const missingItem = createFixture(OrganizationRole.STAFF, false);
    await expect(
      missingItem.service.findById('missing', userId),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' }),
    });

    const missingHolding = createFixture();
    vi.mocked(missingHolding.prisma.holding.findUnique).mockResolvedValue(null);
    await expect(
      missingHolding.service.create(userId, { holdingId: 'missing' }),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' }),
    });
    expect(missingHolding.prisma.item.create).not.toHaveBeenCalled();
  });

  it('rejects blank status values', async () => {
    const { prisma, service } = createFixture();

    await expect(
      service.update(item.id, userId, { status: '   ' }),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        code: 'VALIDATION_INVALID_REQUEST_DATA',
      }),
    });
    expect(prisma.item.update).not.toHaveBeenCalled();
  });
});
