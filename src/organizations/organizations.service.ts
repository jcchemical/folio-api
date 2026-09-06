import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from './organization-membership.service.js';
import type { CreateOrganizationDto } from './dto/create-organization.dto.js';
import type { UpdateOrganizationDto } from './dto/update-organization.dto.js';

export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  createdAt: Date;
};

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.memberships.getMemberships(userId);
    return memberships.map(({ organization, role }) =>
      this.toSummary(organization, role),
    );
  }

  async findOneByUser(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationSummary> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const membership = await this.memberships.requireMembership(
      userId,
      organizationId,
    );
    return this.toSummary(organization, membership.role);
  }

  async create(
    userId: string,
    input: CreateOrganizationDto,
  ): Promise<OrganizationSummary> {
    const name = normalizeOrganizationName(input.name);
    const organization = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.organization.create({
        data: { name },
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

    return this.toSummary(organization, OrganizationRole.OWNER);
  }

  async update(
    userId: string,
    organizationId: string,
    input: UpdateOrganizationDto,
  ): Promise<OrganizationSummary> {
    const organization = await this.requireOrganization(organizationId);
    await this.memberships.assertRole(
      userId,
      organizationId,
      OrganizationRole.ADMIN,
    );

    if (input.name === undefined) {
      const membership = await this.memberships.requireMembership(
        userId,
        organizationId,
        OrganizationRole.ADMIN,
      );
      return this.toSummary(organization, membership.role);
    }

    const name = normalizeOrganizationName(input.name);
    const updated = await this.prisma.$transaction((transaction) =>
      transaction.organization.update({
        where: { id: organizationId },
        data: { name },
      }),
    );
    const membership = await this.memberships.requireMembership(
      userId,
      organizationId,
      OrganizationRole.ADMIN,
    );
    return this.toSummary(updated, membership.role);
  }

  async remove(userId: string, organizationId: string): Promise<never> {
    await this.requireOrganization(organizationId);
    await this.memberships.assertRole(
      userId,
      organizationId,
      OrganizationRole.OWNER,
    );

    throw new ConflictException(
      'Organization deletion is disabled until Works and Items have a safe reassignment policy',
    );
  }

  private async requireOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  private toSummary(
    organization: { id: string; name: string; createdAt: Date },
    role: OrganizationRole,
  ): OrganizationSummary {
    return {
      id: organization.id,
      name: organization.name,
      role,
      createdAt: organization.createdAt,
    };
  }
}

export function normalizeOrganizationName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new BadRequestException('Organization name cannot be empty');
  return name;
}
