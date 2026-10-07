import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { BibliographicRecordsService } from './bibliographic_records.service.js';

const userId = 'user-1';
const work = { id: 'work-1', organizationId: 'organization-1' };
const edition = { id: 'edition-1', work };
const record = {
  id: 'record-1',
  editionId: edition.id,
  edition,
  rawContent: '<record />',
};

function createService(authorized: boolean, result = record as object | null) {
  const prisma = {
    bibliographicRecord: {
      findUnique: vi.fn().mockResolvedValue(result),
      findMany: vi.fn().mockResolvedValue([record]),
    },
    edition: {
      findUnique: vi.fn().mockResolvedValue(edition),
    },
  } as unknown as PrismaService;
  const memberships = {
    assertWorkAccess: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new ForbiddenException()),
  } as unknown as OrganizationMembershipService;

  return {
    prisma,
    memberships,
    service: new BibliographicRecordsService(prisma, memberships),
  };
}

describe('BibliographicRecordsService.findOne', () => {
  it('authorizes through the required Edition target and its Work', async () => {
    const { prisma, memberships, service } = createService(true);

    await expect(service.findOne(userId, record.id)).resolves.toEqual(record);
    expect(prisma.bibliographicRecord.findUnique).toHaveBeenCalledWith({
      where: { id: record.id },
      include: { edition: { include: { work: true } } },
    });
    expect(memberships.assertWorkAccess).toHaveBeenCalledWith(userId, work);
  });

  it('rejects a non-member of the Edition Work organization', async () => {
    const { service } = createService(false);

    await expect(service.findOne(userId, record.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 404 when the record does not exist', async () => {
    const { service } = createService(true, null);

    await expect(service.findOne(userId, record.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('BibliographicRecordsService.findByEdition', () => {
  it('returns records only after authorizing access to the Edition Work', async () => {
    const { memberships, service } = createService(true);

    await expect(service.findByEdition(userId, edition.id)).resolves.toEqual([
      record,
    ]);
    expect(memberships.assertWorkAccess).toHaveBeenCalledWith(userId, work);
  });

  it('rejects users without access to the Edition Work', async () => {
    const { service } = createService(false);

    await expect(
      service.findByEdition('external-user', edition.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 when the Edition does not exist', async () => {
    const prisma = {
      bibliographicRecord: { findMany: vi.fn() },
      edition: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const memberships = {
      assertWorkAccess: vi.fn(),
    } as unknown as OrganizationMembershipService;
    const service = new BibliographicRecordsService(prisma, memberships);

    await expect(
      service.findByEdition(userId, 'missing-edition'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
