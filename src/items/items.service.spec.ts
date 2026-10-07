import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { ItemsService } from './items.service.js';

const userId = 'items-user-1';
const organizationId = `c${'a'.repeat(24)}`;
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
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: organizationId }),
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
  const memberships = new OrganizationMembershipService(prisma);
  const service = new ItemsService(
    prisma,
    new OrganizationContextResolver(memberships),
  );
  return { prisma, service };
}

describe('ItemsService Holding ownership', () => {
  it('creates an Item from a persisted Holding without duplicating ownership or location', async () => {
    const { prisma, service } = createFixture();

    await service.create(
      userId,
      {
        holdingId: holding.id,
        label: 'Reference copy',
        status: 'OWNED',
        notes: 'Preserved copy',
      },
      organizationId,
    );

    expect(prisma.holding.findUnique).toHaveBeenCalledWith({
      where: { id: holding.id },
      include: {
        edition: { include: { work: { include: { organization: true } } } },
        location: { include: { library: { include: { organization: true } } } },
      },
    });
    expect(prisma.item.create).toHaveBeenCalledWith({
      data: {
        holdingId: holding.id,
        label: 'Reference copy',
        status: 'OWNED',
        notes: 'Preserved copy',
      },
      include: expect.any(Object),
    });
  });

  it('authorizes reads through Item → Holding → Edition → Work', async () => {
    const { prisma, service } = createFixture(OrganizationRole.READER);

    await expect(service.findById(item.id, userId)).resolves.toMatchObject(
      item,
    );
    expect(prisma.item.findUnique).toHaveBeenCalledWith({
      where: { id: item.id },
      include: expect.objectContaining({ holding: expect.any(Object) }),
    });
  });

  it('lists only items reachable through an organization membership', async () => {
    const { prisma, service } = createFixture();

    await service.findAllByUser(userId, organizationId);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          holding: {
            edition: { work: { organizationId } },
            location: { library: { organizationId } },
          },
        },
        include: expect.objectContaining({ holding: expect.any(Object) }),
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
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
      }),
    });
    await expect(
      service.update(item.id, userId, { label: 'No' }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
      }),
    });
    await expect(service.remove(item.id, userId)).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
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
      include: expect.any(Object),
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

  it('fails closed for inconsistent persisted Holding parents and conflicting context before mutation', async () => {
    const inconsistentFixture = createFixture();
    vi.mocked(inconsistentFixture.prisma.item.findUnique).mockResolvedValue({
      ...item,
      holding: {
        ...holding,
        location: {
          id: 'location-b',
          library: { id: 'library-b', organizationId: `c${'b'.repeat(24)}` },
        },
      },
    } as never);

    await expect(
      inconsistentFixture.service.findById(item.id, userId),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });

    const conflictFixture = createFixture();
    await expect(
      conflictFixture.service.update(
        item.id,
        userId,
        { label: 'Must not update' },
        `c${'b'.repeat(24)}`,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(conflictFixture.prisma.item.update).not.toHaveBeenCalled();
  });

  it('does not create, update, or delete through an inconsistent persisted Holding', async () => {
    const local = createFixture();
    const inconsistentItem = {
      ...item,
      holding: {
        ...holding,
        location: {
          id: 'location-b',
          library: { id: 'library-b', organizationId: `c${'b'.repeat(24)}` },
        },
      },
    };
    vi.mocked(local.prisma.item.findUnique).mockResolvedValue(
      inconsistentItem as never,
    );
    vi.mocked(local.prisma.holding.findUnique).mockResolvedValue(
      inconsistentItem.holding as never,
    );

    await expect(
      local.service.create(userId, { holdingId: holding.id }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    await expect(
      local.service.update(item.id, userId, { label: 'No write' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    await expect(local.service.remove(item.id, userId)).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(local.prisma.item.create).not.toHaveBeenCalled();
    expect(local.prisma.item.update).not.toHaveBeenCalled();
    expect(local.prisma.item.delete).not.toHaveBeenCalled();
  });

  it('rejects null status instead of silently treating it as an omitted value', async () => {
    const local = createFixture();

    await expect(
      local.service.update(item.id, userId, { status: null } as never),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_INVALID_REQUEST_DATA' },
    });
    expect(local.prisma.item.update).not.toHaveBeenCalled();
  });
});
