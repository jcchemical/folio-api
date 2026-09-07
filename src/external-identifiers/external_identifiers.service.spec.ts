import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExternalIdentifiersService } from './external_identifiers.service.js';

const work = { organizationId: 'organization-a' };
const edition = { id: 'edition-a', work };

function createService() {
  const prisma = {
    edition: { findUnique: vi.fn().mockResolvedValue(edition) },
    externalIdentifier: {
      create: vi.fn().mockResolvedValue({ id: 'identifier-a' }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'identifier-a',
        type: 'ISBN-13',
        value: '9789898236005',
        edition,
      }),
      update: vi.fn().mockResolvedValue({ id: 'identifier-a' }),
    },
  };
  const memberships = {
    assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    memberships,
    service: new ExternalIdentifiersService(prisma as never, memberships as never),
  };
}

describe('ExternalIdentifiersService organization scope', () => {
  it('derives organizationId from the authorized edition on create', async () => {
    const { service, prisma } = createService();

    await service.create('user-a', {
      type: 'ISBN-13',
      value: '9789898236005',
      editionId: 'edition-a',
    });

    expect(prisma.externalIdentifier.create).toHaveBeenCalledWith({
      data: {
        type: 'ISBN-13',
        value: '9789898236005',
        editionId: 'edition-a',
        organizationId: 'organization-a',
      },
    });
  });

  it('maps a same-organization unique violation to 409', async () => {
    const { service, prisma } = createService();
    prisma.externalIdentifier.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create('user-a', {
        type: 'ISBN-13',
        value: '9789898236005',
        editionId: 'edition-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an update that moves an identifier to an unauthorized edition', async () => {
    const { service, prisma, memberships } = createService();
    prisma.edition.findUnique.mockResolvedValue({
      id: 'edition-b',
      work: { organizationId: 'organization-b' },
    });
    memberships.assertWorkWriteAccess.mockRejectedValue(new ForbiddenException());

    await expect(
      service.update('identifier-a', 'user-a', { editionId: 'edition-b' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.externalIdentifier.update).not.toHaveBeenCalled();
  });

  it('rejects an update that moves an identifier across organizations', async () => {
    const { service, prisma } = createService();
    prisma.edition.findUnique.mockResolvedValue({
      id: 'edition-b',
      work: { organizationId: 'organization-b' },
    });

    await expect(
      service.update('identifier-a', 'user-a', { editionId: 'edition-b' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.externalIdentifier.update).not.toHaveBeenCalled();
  });
});
