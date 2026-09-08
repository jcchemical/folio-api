import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { EditionsService } from './editions.service.js';

const userId = 'user-1';
const edition = {
  id: 'edition-1',
  work: { id: 'work-1', organizationId: 'organization-1' },
};

function createService(role: OrganizationRole | null) {
  const prisma = {
    edition: {
      findUnique: vi.fn().mockResolvedValue(edition),
      delete: vi.fn().mockResolvedValue(edition),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue(
        role ? { role, organization: { id: edition.work.organizationId } } : null,
      ),
    },
  } as unknown as PrismaService;
  const memberships = new OrganizationMembershipService(prisma);

  return { prisma, service: new EditionsService(prisma, memberships) };
}

describe('EditionsService.remove', () => {
  it('rejects a READER with 403 Forbidden', async () => {
    const { prisma, service } = createService(OrganizationRole.READER);

    await expect(service.remove(edition.id, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.edition.delete).not.toHaveBeenCalled();
  });

  it.each([
    OrganizationRole.STAFF,
    OrganizationRole.ADMIN,
    OrganizationRole.OWNER,
  ])('allows %s to delete an edition', async (role) => {
    const { prisma, service } = createService(role);

    await expect(service.remove(edition.id, userId)).resolves.toEqual(edition);
    expect(prisma.edition.delete).toHaveBeenCalledWith({
      where: { id: edition.id },
    });
  });

  it('rejects a non-member with 403 Forbidden', async () => {
    const { prisma, service } = createService(null);

    await expect(service.remove(edition.id, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.edition.delete).not.toHaveBeenCalled();
  });
});

describe('EditionsService physical descriptions', () => {
  it('creates descriptions in supplied order for an authorized member', async () => {
    const prisma = {
      work: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'work-1',
          organizationId: 'organization-1',
        }),
      },
      edition: {
        create: vi.fn().mockResolvedValue({
          id: 'edition-1',
          physicalDescriptions: [],
        }),
      },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: OrganizationRole.STAFF,
          organization: { id: 'organization-1' },
        }),
      },
    } as unknown as PrismaService;
    const service = new EditionsService(
      prisma,
      new OrganizationMembershipService(prisma),
    );

    await service.create('user-1', 'work-1', {
      title: 'Edition',
      physicalDescriptions: [
        { sortOrder: 0, parts: [
          { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
          { subfield: 'd', value: '24 cm', sortOrder: 1 },
        ] },
      ],
    });

    expect(prisma.edition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        physicalDescriptions: {
          create: [
            expect.objectContaining({
              sortOrder: 0,
              parts: { create: [
                { subfield: 'a', value: '146, [6] p.', sortOrder: 0, normalizedValue: null },
                { subfield: 'd', value: '24 cm', sortOrder: 1, normalizedValue: null },
              ] },
            }),
          ],
        },
      }),
      include: {
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
      },
    });
  });

  it('replaces descriptions transactionally on update', async () => {
    const transaction = {
      edition: {
        update: vi.fn().mockResolvedValue({ id: 'edition-1' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'edition-1',
          physicalDescriptions: [],
        }),
      },
      physicalDescription: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'field-1', sortOrder: 0 }]),
      },
      physicalDescriptionPart: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      edition: {
        findUnique: vi.fn().mockResolvedValue(edition),
      },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: OrganizationRole.STAFF,
          organization: { id: 'organization-1' },
        }),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    } as unknown as PrismaService;
    const service = new EditionsService(
      prisma,
      new OrganizationMembershipService(prisma),
    );

    await service.update('edition-1', userId, {
      physicalDescriptions: [
        { sortOrder: 0, parts: [
          { subfield: 'a', value: '146, [6] p.', sortOrder: 0 },
        ] },
      ],
    });

    expect(transaction.physicalDescription.deleteMany).toHaveBeenCalledWith({
      where: { editionId: 'edition-1' },
    });
    expect(transaction.physicalDescriptionPart.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          subfield: 'a',
          value: '146, [6] p.',
          sortOrder: 0,
        }),
      ],
    });
  });
});

describe('EditionsService publication statements update semantics', () => {
  function createUpdateService() {
    const transaction = {
      edition: {
        update: vi.fn().mockResolvedValue({ id: 'edition-1' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'edition-1', publicationStatements: [] }),
      },
      publicationStatement: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'statement-1', sortOrder: 0 }]),
      },
      publicationStatementPart: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      edition: { findUnique: vi.fn().mockResolvedValue(edition) },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({
          role: OrganizationRole.STAFF,
          organization: { id: 'organization-1' },
        }),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as PrismaService;
    return { service: new EditionsService(prisma, new OrganizationMembershipService(prisma)), transaction };
  }

  const statement = {
    sortOrder: 0,
    parts: [{ subfield: 'c', value: 'Editora', sortOrder: 0 }],
  };

  it('preserves existing statements when publicationStatements is omitted', async () => {
    const { service, transaction } = createUpdateService();

    await service.update(edition.id, userId, { title: 'Updated title' });

    expect(transaction.publicationStatement.deleteMany).not.toHaveBeenCalled();
    expect(transaction.edition.update).toHaveBeenCalledWith({
      where: { id: edition.id },
      data: { title: 'Updated title' },
    });
  });

  it('removes statements and clears projections for an explicit empty list', async () => {
    const { service, transaction } = createUpdateService();

    await service.update(edition.id, userId, { publicationStatements: [] });

    expect(transaction.publicationStatement.deleteMany).toHaveBeenCalledWith({ where: { editionId: edition.id } });
    expect(transaction.publicationStatement.createMany).not.toHaveBeenCalled();
    expect(transaction.edition.update).toHaveBeenCalledWith({
      where: { id: edition.id },
      data: { publisher: null, publicationDate: null, publicationPlace: null },
    });
  });

  it('replaces statements and recomputes projections for a non-empty list', async () => {
    const { service, transaction } = createUpdateService();

    await service.update(edition.id, userId, { publicationStatements: [statement] });

    expect(transaction.publicationStatement.deleteMany).toHaveBeenCalledWith({ where: { editionId: edition.id } });
    expect(transaction.publicationStatement.createMany).toHaveBeenCalledWith({
      data: [{ editionId: edition.id, sortOrder: 0, indicator1: ' ', indicator2: '9', source: null }],
    });
    expect(transaction.publicationStatementPart.createMany).toHaveBeenCalledWith({
      data: [{ publicationStatementId: 'statement-1', subfield: 'c', value: 'Editora', sortOrder: 0, normalizedValue: null }],
    });
    expect(transaction.edition.update).toHaveBeenCalledWith({
      where: { id: edition.id },
      data: { publisher: 'Editora', publicationDate: null, publicationPlace: null },
    });
  });
});