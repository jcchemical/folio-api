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