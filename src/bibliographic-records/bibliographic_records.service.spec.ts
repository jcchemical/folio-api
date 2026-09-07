import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { BibliographicRecordsService } from './bibliographic_records.service.js';

const userId = 'user-1';
const record = {
  id: 'record-1',
  rawContent: '<record />',
  work: { id: 'work-1', organizationId: 'organization-1' },
  edition: null,
};

function createService(authorized: boolean, result: typeof record | null = record) {
  const prisma = {
    bibliographicRecord: {
      findUnique: vi.fn().mockResolvedValue(result),
    },
  } as unknown as PrismaService;
  const memberships = {
    assertWorkAccess: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new ForbiddenException()),
  } as unknown as OrganizationMembershipService;

  return { memberships, service: new BibliographicRecordsService(prisma, memberships) };
}

describe('BibliographicRecordsService.findOne', () => {
  it('returns a record to a member of its work organization', async () => {
    const { memberships, service } = createService(true);

    await expect(service.findOne(userId, record.id)).resolves.toEqual(record);
    expect(memberships.assertWorkAccess).toHaveBeenCalledWith(userId, record.work);
  });

  it('rejects a non-member with 403 Forbidden', async () => {
    const { service } = createService(false);

    await expect(service.findOne(userId, record.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('authorizes through an Edition work instead of an unrelated direct work', async () => {
    const editionWork = {
      id: 'edition-work-1',
      organizationId: 'organization-member',
    };
    const recordWithIndirectWork = {
      id: 'record-through-edition-1',
      rawContent: '<record />',
      work: { id: 'unrelated-work-1', organizationId: 'organization-other' },
      edition: { id: 'edition-1', work: editionWork },
    };
    const prisma = {
      bibliographicRecord: {
        findUnique: vi.fn().mockResolvedValue(recordWithIndirectWork),
      },
    } as unknown as PrismaService;
    const memberMemberships = {
      assertWorkAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as OrganizationMembershipService;
    const nonMemberMemberships = {
      assertWorkAccess: vi.fn().mockRejectedValue(new ForbiddenException()),
    } as unknown as OrganizationMembershipService;

    await expect(
      new BibliographicRecordsService(prisma, memberMemberships).findOne(
        userId,
        recordWithIndirectWork.id,
      ),
    ).resolves.toEqual(recordWithIndirectWork);
    expect(memberMemberships.assertWorkAccess).toHaveBeenCalledWith(
      userId,
      editionWork,
    );

    await expect(
      new BibliographicRecordsService(prisma, nonMemberMemberships).findOne(
        'external-user',
        recordWithIndirectWork.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(nonMemberMemberships.assertWorkAccess).toHaveBeenCalledWith(
      'external-user',
      editionWork,
    );
  });

  it('returns 404 when the record does not exist', async () => {
    const { service } = createService(true, null);

    await expect(service.findOne(userId, record.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});