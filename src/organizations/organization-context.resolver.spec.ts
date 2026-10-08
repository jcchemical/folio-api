import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from './organization-membership.service.js';
import {
  OrganizationContextResolver,
  parseOrganizationContextHeader,
} from './organization-context.resolver.js';

const userId = 'user-1';
const organizationA = { id: `c${'a'.repeat(24)}`, name: 'A' };
const organizationB = { id: `c${'b'.repeat(24)}`, name: 'B' };

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw.');
}

function createResolver(
  options: {
    memberships?: Array<{ organizationId: string; role: OrganizationRole }>;
    currentRole?: () => OrganizationRole;
  } = {},
) {
  const memberships = options.memberships ?? [
    { organizationId: organizationA.id, role: OrganizationRole.STAFF },
    { organizationId: organizationB.id, role: OrganizationRole.READER },
  ];
  const prisma = {
    organization: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const organization = [organizationA, organizationB].find(
          ({ id }) => id === where.id,
        );
        return Promise.resolve(organization ?? null);
      }),
    },
    organizationMembership: {
      findUnique: vi.fn(
        ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const key = where.userId_organizationId;
          if (key.userId !== userId) return Promise.resolve(null);
          const membership = memberships.find(
            ({ organizationId }) => organizationId === key.organizationId,
          );
          if (!membership) return Promise.resolve(null);
          return Promise.resolve({
            ...membership,
            role: options.currentRole?.() ?? membership.role,
            userId,
            organization:
              membership.organizationId === organizationA.id
                ? organizationA
                : organizationB,
          });
        },
      ),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  } as unknown as PrismaService;
  const membershipService = new OrganizationMembershipService(prisma);
  return {
    prisma,
    resolver: new OrganizationContextResolver(membershipService),
    membershipService,
  };
}

describe('parseOrganizationContextHeader', () => {
  it('accepts a CUID and trims only surrounding whitespace', () => {
    expect(parseOrganizationContextHeader(` ${organizationA.id} `, true)).toBe(
      organizationA.id,
    );
  });

  it('returns the stable missing-context error when the required header is absent', () => {
    expect(
      captureError(() => parseOrganizationContextHeader(undefined, true)),
    ).toMatchObject({
      status: 400,
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
      }),
    });
  });

  it.each([
    '',
    'not-an-id',
    'c123',
    `${organizationA.id}, ${organizationB.id}`,
  ])('rejects malformed header value %j', (value) => {
    expect(
      captureError(() => parseOrganizationContextHeader(value, false)),
    ).toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'ORGANIZATION_ID_INVALID' }),
    });
  });

  it('rejects duplicate header values rather than choosing one', () => {
    for (const duplicate of [
      [organizationA.id, organizationA.id],
      [organizationA.id, organizationB.id],
    ]) {
      expect(
        captureError(() => parseOrganizationContextHeader(duplicate, true)),
      ).toMatchObject({
        status: 400,
        response: expect.objectContaining({ code: 'ORGANIZATION_ID_INVALID' }),
      });
    }
  });

  it('does not require a value for optional context', () => {
    expect(parseOrganizationContextHeader(undefined, false)).toBeUndefined();
  });
});

describe('OrganizationContextResolver required root context', () => {
  it('resolves organization and current membership from the explicit header', async () => {
    const { prisma, resolver } = createResolver();

    const context = await resolver.resolveRequiredRootContext({
      userId,
      headerValue: organizationA.id,
    });

    expect(context).toMatchObject({
      organizationId: organizationA.id,
      organization: organizationA,
      membership: { userId, organizationId: organizationA.id, role: 'STAFF' },
      role: OrganizationRole.STAFF,
    });
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: organizationA.id },
    });
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_organizationId: { userId, organizationId: organizationA.id },
      },
      include: { organization: true },
    });
  });

  it('resolves either organization explicitly for a user with two memberships', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationA.id,
      }),
    ).resolves.toMatchObject({ organizationId: organizationA.id });
    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationB.id,
      }),
    ).resolves.toMatchObject({ organizationId: organizationB.id });
  });

  it('returns organization-not-found before membership lookup for an unknown CUID', async () => {
    const { prisma, resolver } = createResolver();
    const unknownId = `c${'z'.repeat(24)}`;

    await expect(
      resolver.resolveRequiredRootContext({ userId, headerValue: unknownId }),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({ code: 'ORGANIZATION_NOT_FOUND' }),
    });
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });

  it('distinguishes an existing organization without membership', async () => {
    const { resolver } = createResolver({ memberships: [] });

    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
        message: 'You do not have access to this organization.',
      }),
    });
  });

  it('returns 401 when no authenticated user reaches the resolver', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.resolveRequiredRootContext({
        userId: undefined,
        headerValue: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: expect.objectContaining({ code: 'AUTH_INVALID_ACCESS_TOKEN' }),
    });
  });

  it('enforces the required role using the persisted membership role', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationB.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
      }),
    });
    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationA.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).resolves.toMatchObject({ role: OrganizationRole.STAFF });
  });

  it('reads membership role afresh for every resolution', async () => {
    let role = OrganizationRole.READER;
    const { resolver, prisma } = createResolver({ currentRole: () => role });

    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationA.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
      }),
    });
    role = OrganizationRole.ADMIN;
    await expect(
      resolver.resolveRequiredRootContext({
        userId,
        headerValue: organizationA.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).resolves.toMatchObject({ role: OrganizationRole.ADMIN });
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledTimes(2);
  });

  it('never uses OWNER or oldest-membership fallback when the header is missing', async () => {
    const { prisma, resolver } = createResolver();

    await expect(
      resolver.resolveRequiredRootContext({ userId, headerValue: undefined }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
      }),
    });
    expect(prisma.organizationMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});

describe('OrganizationContextResolver optional/derived context', () => {
  it('accepts an absent optional header without looking up an organization', async () => {
    const { prisma, resolver } = createResolver();

    await expect(
      resolver.resolveOptionalContext({ userId, headerValue: undefined }),
    ).resolves.toBeUndefined();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('resolves a matching optional header and membership', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.assertHeaderMatchesDerivedContext({
        userId,
        headerValue: organizationA.id,
        derivedOrganizationId: organizationA.id,
      }),
    ).resolves.toBeUndefined();
  });

  it('returns context conflict when an explicit member header differs from derived ownership', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.assertHeaderMatchesDerivedContext({
        userId,
        headerValue: organizationB.id,
        derivedOrganizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_CONFLICT',
      }),
    });
  });

  it('returns context conflict before looking up a mismatching supplied organization', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.assertHeaderMatchesDerivedContext({
        userId,
        headerValue: `c${'z'.repeat(24)}`,
        derivedOrganizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_CONFLICT',
      }),
    });
  });

  it('masks missing membership when resolving a resource without hiding context conflicts', async () => {
    const { resolver: nonMemberResolver } = createResolver({ memberships: [] });

    await expect(
      nonMemberResolver.resolveDerivedResourceContext({
        userId,
        headerValue: organizationB.id,
        derivedOrganizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      }),
    });

    const { resolver } = createResolver();
    await expect(
      resolver.resolveDerivedResourceContext({
        userId,
        headerValue: organizationB.id,
        derivedOrganizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_CONFLICT',
      }),
    });
  });

  it('requires membership in both parent organizations before checking parent context', async () => {
    const { resolver: nonMemberResolver, prisma } = createResolver({
      memberships: [
        { organizationId: organizationA.id, role: OrganizationRole.STAFF },
      ],
    });

    await expect(
      nonMemberResolver.resolveDerivedParentPairContext({
        userId,
        headerValue: organizationA.id,
        firstOrganizationId: organizationA.id,
        secondOrganizationId: organizationB.id,
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: expect.objectContaining({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource was not found.',
      }),
    });
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledTimes(2);
  });

  it('checks a parent-pair header only after membership in both organizations', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.resolveDerivedParentPairContext({
        userId,
        headerValue: organizationB.id,
        firstOrganizationId: organizationA.id,
        secondOrganizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_CONFLICT',
      }),
    });
    await expect(
      resolver.resolveDerivedParentPairContext({
        userId,
        headerValue: 'malformed',
        firstOrganizationId: organizationA.id,
        secondOrganizationId: organizationB.id,
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'ORGANIZATION_ID_INVALID' }),
    });
    await expect(
      resolver.resolveDerivedParentPairContext({
        userId,
        headerValue: undefined,
        firstOrganizationId: organizationA.id,
        secondOrganizationId: organizationB.id,
      }),
    ).resolves.toMatchObject({
      first: { organizationId: organizationA.id },
      second: { organizationId: organizationB.id },
    });
  });

  it('preserves role and invalid-header errors for derived resource context', async () => {
    const { resolver: readerResolver } = createResolver({
      currentRole: () => OrganizationRole.READER,
    });

    await expect(
      readerResolver.resolveDerivedResourceContext({
        userId,
        headerValue: organizationA.id,
        derivedOrganizationId: organizationA.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
      }),
    });

    const { resolver } = createResolver();
    await expect(
      resolver.resolveDerivedResourceContext({
        userId,
        headerValue: 'malformed',
        derivedOrganizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'ORGANIZATION_ID_INVALID' }),
    });
  });

  it('rejects a supplied organization without current membership', async () => {
    const { resolver } = createResolver({ memberships: [] });

    await expect(
      resolver.resolveOptionalContext({
        userId,
        headerValue: organizationA.id,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({
        code: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
      }),
    });
  });

  it('checks a required role only after the optional header matches the derived tenant', async () => {
    const { resolver } = createResolver();

    await expect(
      resolver.assertHeaderMatchesDerivedContext({
        userId,
        headerValue: organizationB.id,
        derivedOrganizationId: organizationA.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ORGANIZATION_CONTEXT_CONFLICT',
      }),
    });
    await expect(
      resolver.assertHeaderMatchesDerivedContext({
        userId,
        headerValue: organizationB.id,
        derivedOrganizationId: organizationB.id,
        requiredRole: OrganizationRole.STAFF,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ORGANIZATION_ROLE_INSUFFICIENT',
      }),
    });
  });
});
