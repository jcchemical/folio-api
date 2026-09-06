import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLE_WEIGHT: Record<OrganizationRole, number> = {
  [OrganizationRole.READER]: 1,
  [OrganizationRole.STAFF]: 2,
  [OrganizationRole.ADMIN]: 3,
  [OrganizationRole.OWNER]: 4,
};

@Injectable()
export class OrganizationMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  getMemberships(userId: string) {
    return this.prisma.organizationMembership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOrganizations(userId: string) {
    const memberships = await this.getMemberships(userId);
    return memberships.map(({ organization, role }) => ({ organization, role }));
  }

  async getDefaultOrganization(userId: string) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId, role: OrganizationRole.OWNER },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    return membership?.organization ?? null;
  }

  async requireMembership(
    userId: string,
    organizationId: string,
    minimumRole: OrganizationRole = OrganizationRole.READER,
  ) {
    const membership =
      await this.prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId, organizationId },
        },
        include: { organization: true },
      });

    if (!membership) {
      throw new ForbiddenException(
        'User is not a member of this organization',
      );
    }
    if (ROLE_WEIGHT[membership.role] < ROLE_WEIGHT[minimumRole]) {
      throw new ForbiddenException(
        `Organization role ${minimumRole} is required`,
      );
    }

    return membership;
  }

  async assertOrganizationAccess(userId: string, organizationId: string) {
    return this.requireMembership(userId, organizationId);
  }

  async assertRole(
    userId: string,
    organizationId: string,
    minimumRole: OrganizationRole,
  ) {
    return this.requireMembership(userId, organizationId, minimumRole);
  }

  async assertWorkAccess(
    userId: string,
    work: { userId: string; organizationId: string | null },
  ): Promise<void> {
    if (!work.organizationId) {
      if (work.userId !== userId) {
        throw new ForbiddenException(
          'Work does not belong to the authenticated user',
        );
      }
      return;
    }

    await this.assertOrganizationAccess(userId, work.organizationId);
  }

  async assertWorkWriteAccess(
    userId: string,
    work: { userId: string; organizationId: string | null },
  ): Promise<void> {
    if (!work.organizationId) {
      if (work.userId !== userId) {
        throw new ForbiddenException(
          'Work does not belong to the authenticated user',
        );
      }
      return;
    }

    await this.assertRole(userId, work.organizationId, OrganizationRole.STAFF);
  }

  async provisionPersonalOrganization(userId: string, email: string) {
    const existing = await this.getDefaultOrganization(userId);
    if (existing) return existing;

    const organization = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.organization.create({
        data: { name: `Biblioteca de ${email}` },
      });
      await transaction.organizationMembership.create({
        data: {
          userId,
          organizationId: created.id,
          role: OrganizationRole.OWNER,
        },
      });
      return created;
    });
    return organization;
  }

  async requireOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }
}

export { OrganizationRole };
