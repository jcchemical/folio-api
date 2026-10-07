import { HttpStatus, Injectable } from '@nestjs/common';
import {
  OrganizationRole,
  type Organization,
  type OrganizationMembership,
} from '@prisma/client';
import {
  API_ERROR_CODES,
  ApiException,
  invalidAccessToken,
} from '../common/api-errors.js';
import { OrganizationMembershipService } from './organization-membership.service.js';

export const FOLIO_ORGANIZATION_HEADER = 'x-folio-organization-id';

export type OrganizationHeaderValue = string | string[] | undefined;

export type ResolvedOrganizationContext = {
  organizationId: string;
  organization: Organization;
  membership: OrganizationMembership;
  role: OrganizationRole;
};

export type OrganizationContextInput = {
  userId: string | null | undefined;
  headerValue: OrganizationHeaderValue;
  requiredRole?: OrganizationRole;
};

const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

export function parseOrganizationContextHeader(
  value: OrganizationHeaderValue,
  required: boolean,
): string | undefined {
  if (value === undefined) {
    if (required) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        API_ERROR_CODES.ORGANIZATION_CONTEXT_REQUIRED,
        'Select an organization before continuing.',
      );
    }
    return undefined;
  }

  // Node/Express normally exposes duplicate header fields as an array or a
  // comma-joined value. Reject both forms rather than choosing one silently.
  if (typeof value !== 'string') {
    throw invalidOrganizationId();
  }
  const organizationId = value.trim();
  if (
    !organizationId ||
    organizationId.includes(',') ||
    !CUID_PATTERN.test(organizationId)
  ) {
    throw invalidOrganizationId();
  }
  return organizationId;
}

@Injectable()
export class OrganizationContextResolver {
  constructor(private readonly memberships: OrganizationMembershipService) {}

  async resolveRequiredRootContext(
    input: OrganizationContextInput,
  ): Promise<ResolvedOrganizationContext> {
    const userId = requireAuthenticatedUserId(input.userId);
    const organizationId = parseOrganizationContextHeader(
      input.headerValue,
      true,
    )!;
    return this.resolveForUser(userId, organizationId, input.requiredRole);
  }

  async resolveOptionalContext(
    input: OrganizationContextInput,
  ): Promise<ResolvedOrganizationContext | undefined> {
    const userId = requireAuthenticatedUserId(input.userId);
    const organizationId = parseOrganizationContextHeader(
      input.headerValue,
      false,
    );
    if (!organizationId) return undefined;
    return this.resolveForUser(userId, organizationId, input.requiredRole);
  }

  async resolveDerivedContext(input: {
    userId: string | null | undefined;
    headerValue: OrganizationHeaderValue;
    derivedOrganizationId: string;
    requiredRole?: OrganizationRole;
  }): Promise<ResolvedOrganizationContext> {
    const userId = requireAuthenticatedUserId(input.userId);
    const headerOrganizationId = parseOrganizationContextHeader(
      input.headerValue,
      false,
    );
    if (
      headerOrganizationId &&
      headerOrganizationId !== input.derivedOrganizationId
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        API_ERROR_CODES.ORGANIZATION_CONTEXT_CONFLICT,
        'The selected organization does not match the requested resource.',
      );
    }
    return this.resolveForUser(
      userId,
      input.derivedOrganizationId,
      input.requiredRole,
    );
  }

  async assertHeaderMatchesDerivedContext(input: {
    userId: string | null | undefined;
    headerValue: OrganizationHeaderValue;
    derivedOrganizationId: string;
    requiredRole?: OrganizationRole;
  }): Promise<void> {
    await this.resolveDerivedContext(input);
  }

  requireRole(
    context: ResolvedOrganizationContext,
    requiredRole: OrganizationRole,
  ): void {
    this.memberships.assertContextRole(context.role, requiredRole);
  }

  private async resolveForUser(
    userId: string,
    organizationId: string,
    requiredRole?: OrganizationRole,
  ): Promise<ResolvedOrganizationContext> {
    const organization =
      await this.memberships.requireOrganization(organizationId);
    const membership = await this.memberships.findMembership(
      userId,
      organizationId,
    );
    if (!membership) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        API_ERROR_CODES.ORGANIZATION_MEMBERSHIP_REQUIRED,
        'You do not have access to this organization.',
      );
    }
    if (requiredRole)
      this.requireRole(
        { organizationId, organization, membership, role: membership.role },
        requiredRole,
      );
    return {
      organizationId,
      organization,
      membership,
      role: membership.role,
    };
  }
}

function requireAuthenticatedUserId(userId: string | null | undefined): string {
  if (typeof userId !== 'string' || !userId.trim()) throw invalidAccessToken();
  return userId;
}

function invalidOrganizationId(): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    API_ERROR_CODES.ORGANIZATION_ID_INVALID,
    'The organization ID is invalid.',
  );
}
