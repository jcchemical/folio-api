import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { ItemsService } from './items.service.js';

const user = { id: 'items-user-1', email: 'items-test@example.test' };
const memberOrganization = { id: 'items-org-1', name: 'Test organization' };
const otherOrganization = { id: 'items-org-2', name: 'Other organization' };
const work = { id: 'items-work-1', organizationId: memberOrganization.id };
const edition = { id: 'items-edition-1', workId: work.id, work };
const item = {
  id: 'items-item-1',
  organizationId: memberOrganization.id,
  editionId: edition.id,
  label: 'Test item',
  location: 'Shelf A',
  status: 'OWNED',
  notes: null,
};

type FixtureOptions = {
  role?: OrganizationRole;
  itemOrganization?: typeof memberOrganization | typeof otherOrganization;
  itemExists?: boolean;
  editionExists?: boolean;
};

function createFixture(options: FixtureOptions = {}) {
  const membership = {
    userId: user.id,
    organizationId: memberOrganization.id,
    role: options.role ?? OrganizationRole.STAFF,
    user,
    organization: memberOrganization,
  };
  const testedItem = {
    ...item,
    organizationId: (options.itemOrganization ?? memberOrganization).id,
  };
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    organization: {
      findUnique: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: string } }) =>
            [memberOrganization, otherOrganization].find(
              ({ id }) => id === where.id,
            ) ?? null,
        ),
    },
    organizationMembership: {
      findUnique: vi.fn().mockImplementation(
        ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const key = where.userId_organizationId;
          return key.userId === membership.userId &&
            key.organizationId === membership.organizationId
            ? membership
            : null;
        },
      ),
    },
    work: {
      findUnique: vi.fn().mockResolvedValue(work),
      delete: vi.fn(),
    },
    edition: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          options.editionExists === false || where.id !== edition.id
            ? null
            : edition,
        ),
      delete: vi.fn(),
    },
    item: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          options.itemExists === false || where.id !== item.id
            ? null
            : testedItem,
        ),
      create: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            ...item,
            ...data,
          }),
        ),
      update: vi
        .fn()
        .mockImplementation(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => ({
            ...testedItem,
            ...data,
            id: where.id,
          }),
        ),
      delete: vi.fn().mockResolvedValue(testedItem),
    },
    bibliographicRecord: { delete: vi.fn(), deleteMany: vi.fn() },
  } as unknown as PrismaService;
  const memberships = new OrganizationMembershipService(prisma);

  return {
    organization: memberOrganization,
    user,
    membership,
    work,
    edition,
    item: testedItem,
    prisma,
    service: new ItemsService(prisma, memberships),
  };
}

describe('ItemsService authorization and write boundaries', () => {
  it('allows STAFF to create an Item and derives organizationId from the Edition Work', async () => {
    const fixture = createFixture();

    await fixture.service.create(user.id, {
      label: 'New copy',
      location: 'Shelf B',
      status: 'OWNED',
      editionId: edition.id,
    });

    expect(fixture.prisma.item.create).toHaveBeenCalledWith({
      data: {
        label: 'New copy',
        location: 'Shelf B',
        status: 'OWNED',
        notes: undefined,
        editionId: edition.id,
        organizationId: memberOrganization.id,
      },
    });
  });

  it('ignores a forged organizationId in create input', async () => {
    const fixture = createFixture();

    await fixture.service.create(user.id, {
      label: 'New copy',
      editionId: edition.id,
      organizationId: otherOrganization.id,
    } as never);

    const [{ data }] = vi.mocked(fixture.prisma.item.create).mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(data.organizationId).toBe(memberOrganization.id);
    expect(data).not.toHaveProperty('organizationId', otherOrganization.id);
  });

  it('rejects READER from creating an Item', async () => {
    const fixture = createFixture({ role: OrganizationRole.READER });

    await expect(
      fixture.service.create(user.id, { editionId: edition.id }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
      }),
    });
    expect(fixture.prisma.item.create).not.toHaveBeenCalled();
  });

  it('allows STAFF to update an Item in their organization', async () => {
    const fixture = createFixture();

    await fixture.service.update(item.id, user.id, { label: 'Updated label' });

    expect(fixture.prisma.item.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        label: 'Updated label',
        location: undefined,
        status: undefined,
        notes: undefined,
      },
    });
  });

  it('rejects READER from updating an Item', async () => {
    const fixture = createFixture({ role: OrganizationRole.READER });

    await expect(
      fixture.service.update(item.id, user.id, { label: 'forbidden update' }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
      }),
    });
    expect(fixture.prisma.item.update).not.toHaveBeenCalled();
  });

  it('ignores organizationId and editionId in update input', async () => {
    const fixture = createFixture();

    await fixture.service.update(item.id, user.id, {
      label: 'Safe update',
      organizationId: otherOrganization.id,
      editionId: 'foreign-edition',
    } as never);

    expect(fixture.prisma.item.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        label: 'Safe update',
        location: undefined,
        status: undefined,
        notes: undefined,
      },
    });
    expect(fixture.prisma.edition.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an empty status and does not update the Item', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.update(item.id, user.id, { status: '   ' }),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        code: 'VALIDATION_INVALID_REQUEST_DATA',
      }),
    });
    expect(fixture.prisma.item.update).not.toHaveBeenCalled();
  });

  it('ignores unknown mass-assignment fields in update input', async () => {
    const fixture = createFixture();

    await fixture.service.update(item.id, user.id, {
      notes: 'Safe note',
      passwordHash: 'not-a-field',
      bibliographicRecords: [],
      workId: 'foreign-work',
    } as never);

    const [{ data }] = vi.mocked(fixture.prisma.item.update).mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(data).toEqual({
      label: undefined,
      location: undefined,
      status: undefined,
      notes: 'Safe note',
    });
    expect(data).not.toHaveProperty('passwordHash');
    expect(data).not.toHaveProperty('bibliographicRecords');
    expect(data).not.toHaveProperty('workId');
  });

  it('allows STAFF to remove only the Item record', async () => {
    const fixture = createFixture();

    await fixture.service.remove(item.id, user.id);

    expect(fixture.prisma.item.delete).toHaveBeenCalledWith({
      where: { id: item.id },
    });
    expect(fixture.prisma.edition.findUnique).not.toHaveBeenCalled();
    expect(fixture.prisma.work.findUnique).not.toHaveBeenCalled();
    expect(fixture.prisma.edition.delete).not.toHaveBeenCalled();
    expect(fixture.prisma.work.delete).not.toHaveBeenCalled();
    expect(fixture.prisma.bibliographicRecord.delete).not.toHaveBeenCalled();
    expect(
      fixture.prisma.bibliographicRecord.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('rejects READER from removing an Item', async () => {
    const fixture = createFixture({ role: OrganizationRole.READER });

    await expect(
      fixture.service.remove(item.id, user.id),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
      }),
    });
    expect(fixture.prisma.item.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when removing a nonexistent Item', async () => {
    const fixture = createFixture({ itemExists: false });

    await expect(
      fixture.service.remove('missing-item', user.id),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'RESOURCE_NOT_FOUND' }),
    });
    expect(fixture.prisma.item.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when removing an Item belonging to another organization', async () => {
    const fixture = createFixture({ itemOrganization: otherOrganization });

    await expect(
      fixture.service.remove(item.id, user.id),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'AUTHORIZATION_MEMBERSHIP_REQUIRED',
      }),
    });
    expect(fixture.prisma.item.delete).not.toHaveBeenCalled();
  });
});
