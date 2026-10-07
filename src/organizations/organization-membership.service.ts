import { HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ROLE_WEIGHT: Record<OrganizationRole, number> = {
  [OrganizationRole.READER]: 1,
  [OrganizationRole.STAFF]: 2,
  [OrganizationRole.ADMIN]: 3,
  [OrganizationRole.OWNER]: 4,
};

export function roleMeetsMinimum(
  actualRole: OrganizationRole,
  minimumRole: OrganizationRole,
): boolean {
  return ROLE_WEIGHT[actualRole] >= ROLE_WEIGHT[minimumRole];
}

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
    const membership = await this.findMembership(userId, organizationId);

    if (!membership) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        API_ERROR_CODES.UNAUTHORIZED_MEMBERSHIP,
        'User is not a member of this organization.',
      );
    }
    if (!roleMeetsMinimum(membership.role, minimumRole)) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        minimumRole === OrganizationRole.READER
          ? API_ERROR_CODES.UNAUTHORIZED_MEMBERSHIP
          : API_ERROR_CODES.UNAUTHORIZED_WRITE_ROLE,
        `Organization role ${minimumRole} is required.`,
      );
    }

    return membership;
  }

  findMembership(userId: string, organizationId: string) {
    return this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      include: { organization: true },
    });
  }

  assertContextRole(
    role: OrganizationRole,
    minimumRole: OrganizationRole,
  ): void {
    if (roleMeetsMinimum(role, minimumRole)) return;
    throw new ApiException(
      HttpStatus.FORBIDDEN,
      API_ERROR_CODES.ORGANIZATION_ROLE_INSUFFICIENT,
      `Organization role ${minimumRole} is required.`,
    );
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
    work: { organizationId: string },
  ): Promise<void> {
    await this.assertOrganizationAccess(userId, work.organizationId);
  }

  async assertWorkWriteAccess(
    userId: string,
    work: { organizationId: string },
  ): Promise<void> {
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
    if (!organization)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.ORGANIZATION_NOT_FOUND,
        'Organization not found.',
      );
    return organization;
  }
}

export { OrganizationRole };
