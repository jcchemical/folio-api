import { AgentKind, OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AgentsService } from './agents.service.js';

const agent = {
  id: 'agent-1',
  organizationId: 'org-a',
  kind: AgentKind.PERSON,
  displayName: 'Doe, Jane',
  normalizedDisplayName: 'doe, jane',
};

function createService(
  role: OrganizationRole | 'NONE' = OrganizationRole.STAFF,
  stored: typeof agent | null = agent,
  duplicate: unknown = null,
) {
  const prisma = {
    agent: {
      findMany: vi.fn().mockResolvedValue([agent]),
      findUnique: vi.fn().mockResolvedValue(stored),
      findFirst: vi.fn().mockResolvedValue(duplicate),
      create: vi.fn().mockResolvedValue(agent),
      update: vi.fn().mockResolvedValue(agent),
      delete: vi.fn().mockResolvedValue(agent),
    },
  };
  const gate = (requiredRole?: OrganizationRole, orgId = 'org-a') => {
    if (role === 'NONE') {
      return Promise.reject({
        status: 403,
        response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
      });
    }
    if (role === OrganizationRole.READER && requiredRole) {
      return Promise.reject({
        status: 403,
        response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
      });
    }
    return Promise.resolve({ organizationId: orgId, role });
  };
  const contexts = {
    resolveRequiredRootContext: vi.fn(
      (input: { headerValue?: string; requiredRole?: OrganizationRole }) =>
        input.headerValue
          ? gate(input.requiredRole)
          : Promise.reject({
              status: 400,
              response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
            }),
    ),
    resolveDerivedResourceContext: vi.fn(
      (input: {
        derivedOrganizationId: string;
        requiredRole?: OrganizationRole;
      }) => gate(input.requiredRole, input.derivedOrganizationId),
    ),
  } as unknown as OrganizationContextResolver;
  return {
    prisma,
    contexts,
    service: new AgentsService(prisma as unknown as PrismaService, contexts),
  };
}

const input = { displayName: '  Doe,   Jane ', kind: AgentKind.PERSON };

describe('AgentsService', () => {
  it('creates an Agent in the explicit Organization with normalized name', async () => {
    const { prisma, service } = createService();
    await service.create('user-a', input, 'org-a');
    expect(prisma.agent.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-a',
        kind: AgentKind.PERSON,
        displayName: 'Doe,   Jane',
        normalizedDisplayName: 'doe, jane',
      },
    });
  });

  it('requires Organization context for create and list', async () => {
    const { prisma, service } = createService();
    await expect(service.create('user-a', input)).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
    });
    await expect(service.list('user-a', undefined)).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
    });
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });

  it('rejects invalid Organization headers before any query', async () => {
    const { prisma, service } = createService();
    await expect(
      service.findById('agent-1', 'user-a', ['a', 'b']),
    ).rejects.toMatchObject({ response: { code: 'ORGANIZATION_ID_INVALID' } });
    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
  });

  it('lists only the selected Organization with kind filter and pagination', async () => {
    const { prisma, service } = createService();
    const page = await service.list('user-a', 'org-a', {
      kind: AgentKind.PERSON,
      limit: 1,
    });
    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a', kind: AgentKind.PERSON },
        take: 2,
      }),
    );
    expect(page).toEqual({ items: [agent], nextCursor: null, hasMore: false });
  });

  it('rejects duplicate kind and name in the same Organization', async () => {
    const { prisma, service } = createService(OrganizationRole.STAFF, agent, {
      id: 'agent-2',
    });
    await expect(
      service.create('user-a', input, 'org-a'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT_DUPLICATE_RESOURCE' },
    });
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });

  it('fetches by id and masks missing or foreign Agents as RESOURCE_NOT_FOUND', async () => {
    const found = createService();
    await expect(found.service.findById('agent-1', 'user-a')).resolves.toBe(
      agent,
    );
    const missing = createService(OrganizationRole.STAFF, null);
    await expect(
      missing.service.findById('agent-1', 'user-a'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('denies non-members before reading or mutating', async () => {
    const { prisma, service } = createService('NONE');
    await expect(
      service.update('agent-1', 'user-x', { displayName: 'X' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    await expect(service.remove('agent-1', 'user-x')).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    expect(prisma.agent.update).not.toHaveBeenCalled();
    expect(prisma.agent.delete).not.toHaveBeenCalled();
  });

  it('denies Reader writes without mutation', async () => {
    const { prisma, service } = createService(OrganizationRole.READER);
    await expect(
      service.create('reader', input, 'org-a'),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    await expect(
      service.update('agent-1', 'reader', { displayName: 'X' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    await expect(service.remove('agent-1', 'reader')).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    await expect(service.findById('agent-1', 'reader')).resolves.toBe(agent);
    expect(prisma.agent.create).not.toHaveBeenCalled();
    expect(prisma.agent.update).not.toHaveBeenCalled();
    expect(prisma.agent.delete).not.toHaveBeenCalled();
  });

  it('lets STAFF update and delete, deriving the tenant from the stored Agent', async () => {
    const { prisma, contexts, service } = createService();
    await service.update('agent-1', 'user-a', { displayName: 'Roe, Jane' });
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: {
        kind: AgentKind.PERSON,
        displayName: 'Roe, Jane',
        normalizedDisplayName: 'roe, jane',
      },
    });
    await service.remove('agent-1', 'user-a');
    expect(prisma.agent.delete).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
    });
    expect(contexts.resolveDerivedResourceContext).toHaveBeenCalledWith(
      expect.objectContaining({
        derivedOrganizationId: 'org-a',
        requiredRole: OrganizationRole.STAFF,
      }),
    );
  });

  it('rejects blank names', async () => {
    const { prisma, service } = createService();
    await expect(
      service.create(
        'user-a',
        { displayName: '   ', kind: AgentKind.PERSON },
        'org-a',
      ),
    ).rejects.toMatchObject({
      response: { code: 'VALIDATION_INVALID_REQUEST_DATA' },
    });
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });
});
