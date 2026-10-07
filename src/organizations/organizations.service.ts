import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from './organization-context.resolver.js';
import type { OrganizationHeaderValue } from './organization-context.resolver.js';
import { OrganizationMembershipService } from './organization-membership.service.js';
import type { CreateOrganizationDto } from './dto/create-organization.dto.js';
import type { UpdateOrganizationDto } from './dto/update-organization.dto.js';

export type OrganizationSummary = {
  id: string;
  name: string;
  defaultCatalogueSource: string | null;
  enabledCatalogueSources: string[];
  role: OrganizationRole;
  createdAt: Date;
};

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
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
    headerValue?: OrganizationHeaderValue,
  ): Promise<OrganizationSummary> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw organizationNotFound();

    const context = await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
    });
    return this.toSummary(organization, context.role);
  }

  async create(
    userId: string,
    input: CreateOrganizationDto,
  ): Promise<OrganizationSummary> {
    const name = normalizeOrganizationName(input.name);
    const organization = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.organization.create({
        data: {
          name,
          defaultCatalogueSource: 'porbase',
          enabledCatalogueSources: ['porbase'],
        },
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
    headerValue?: OrganizationHeaderValue,
  ): Promise<OrganizationSummary> {
    const organization = await this.requireOrganization(organizationId);
    const context = await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.ADMIN,
    });

    if (input.name === undefined) {
      return this.toSummary(organization, context.role);
    }

    const name = normalizeOrganizationName(input.name);
    const updated = await this.prisma.$transaction((transaction) =>
      transaction.organization.update({
        where: { id: organizationId },
        data: { name },
      }),
    );
    return this.toSummary(updated, context.role);
  }

  async remove(
    userId: string,
    organizationId: string,
    headerValue?: OrganizationHeaderValue,
  ): Promise<never> {
    await this.requireOrganization(organizationId);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.OWNER,
    });

    throw new ApiException(
      HttpStatus.CONFLICT,
      API_ERROR_CODES.ORGANIZATION_DELETE_CONFLICT,
      'Organization deletion is disabled until Works and Items have a safe reassignment policy.',
    );
  }

  private async requireOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) throw organizationNotFound();
    return organization;
  }

  private toSummary(
    organization: {
      id: string;
      name: string;
      defaultCatalogueSource: string | null;
      enabledCatalogueSources: string[];
      createdAt: Date;
    },
    role: OrganizationRole,
  ): OrganizationSummary {
    return {
      id: organization.id,
      name: organization.name,
      defaultCatalogueSource: organization.defaultCatalogueSource,
      enabledCatalogueSources: organization.enabledCatalogueSources,
      role,
      createdAt: organization.createdAt,
    };
  }
}

function organizationNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.ORGANIZATION_NOT_FOUND,
    'Organization not found.',
  );
}

export function normalizeOrganizationName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new BadRequestException('Organization name cannot be empty');
  return name;
}
