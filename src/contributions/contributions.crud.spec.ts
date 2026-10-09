import { OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ContributionsService } from './contributions.service.js';

const base = {
  id: 'c-1',
  agentId: 'agent-1',
  agent: { id: 'agent-1' },
  sourceParts: [],
};
const workContribution = {
  ...base,
  workId: 'work-1',
  editionId: null,
  work: { organizationId: 'org-a' },
  edition: null,
};
const editionContribution = {
  ...base,
  workId: null,
  editionId: 'edition-1',
  work: null,
  edition: { work: { organizationId: 'org-b' } },
};

function createService(
  role: OrganizationRole | 'NONE' = OrganizationRole.STAFF,
  stored:
    | typeof workContribution
    | typeof editionContribution
    | null = workContribution,
) {
  const prisma = {
    contribution: {
      findMany: vi.fn().mockResolvedValue([base]),
      findUnique: vi.fn().mockResolvedValue(stored),
      update: vi.fn().mockResolvedValue(base),
      delete: vi.fn().mockResolvedValue(base),
    },
  };
  const contexts = {
    resolveRequiredRootContext: vi.fn((input: { headerValue?: string }) =>
      input.headerValue
        ? Promise.resolve({ organizationId: 'org-a' })
        : Promise.reject({
            response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
          }),
    ),
    resolveDerivedResourceContext: vi.fn(
      (input: { requiredRole?: OrganizationRole }) => {
        if (role === 'NONE') {
          return Promise.reject({
            response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
          });
        }
        if (role === OrganizationRole.READER && input.requiredRole) {
          return Promise.reject({
            response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
          });
        }
        return Promise.resolve({ role });
      },
    ),
  } as unknown as OrganizationContextResolver;
  return {
    prisma,
    contexts,
    service: new ContributionsService(
      prisma as unknown as PrismaService,
      contexts,
    ),
  };
}

describe('ContributionsService read/update/delete', () => {
  it('lists with explicit context, Organization scope, filters and pagination', async () => {
    const { prisma, service } = createService();
    await expect(service.list('user-a', undefined)).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
    });
    const page = await service.list('user-a', 'org-a', {
      workId: 'work-1',
      agentId: 'agent-1',
      limit: 1,
    });
    expect(page.items).toEqual([base]);
    expect(prisma.contribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { work: { organizationId: 'org-a' } },
                { edition: { work: { organizationId: 'org-a' } } },
              ],
            },
            { workId: 'work-1' },
            { agentId: 'agent-1' },
          ],
        },
        take: 2,
      }),
    );
  });

  it('fetches without leaking ownership helper fields and masks missing records', async () => {
    const { service } = createService();
    const result = await service.findById('c-1', 'user-a');
    expect(result).not.toHaveProperty('work');
    expect(result).not.toHaveProperty('edition');
    const missing = createService(OrganizationRole.STAFF, null);
    await expect(
      missing.service.findById('c-1', 'user-a'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('derives the tenant through Edition to Work', async () => {
    const { contexts, service } = createService(
      OrganizationRole.STAFF,
      editionContribution,
    );
    await service.update('c-1', 'user-a', { roleLabel: ' editor ' });
    expect(contexts.resolveDerivedResourceContext).toHaveBeenCalledWith(
      expect.objectContaining({
        derivedOrganizationId: 'org-b',
        requiredRole: OrganizationRole.STAFF,
      }),
    );
  });

  it('updates only roleLabel and sortOrder; blank label clears it', async () => {
    const { prisma, service } = createService();
    await service.update('c-1', 'user-a', { roleLabel: '  ', sortOrder: 3 });
    expect(prisma.contribution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c-1' },
        data: { roleLabel: null, sortOrder: 3 },
      }),
    );
  });

  it('deletes only after STAFF authorization', async () => {
    const { prisma, service } = createService();
    await service.remove('c-1', 'user-a');
    expect(prisma.contribution.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c-1' } }),
    );
  });

  it('denies Reader writes and non-member access without mutation', async () => {
    const reader = createService(OrganizationRole.READER);
    await expect(
      reader.service.update('c-1', 'reader', { sortOrder: 1 }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    await expect(reader.service.remove('c-1', 'reader')).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    await expect(
      reader.service.findById('c-1', 'reader'),
    ).resolves.toBeDefined();
    const outsider = createService('NONE');
    await expect(
      outsider.service.remove('c-1', 'user-x'),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    for (const { prisma } of [reader, outsider]) {
      expect(prisma.contribution.update).not.toHaveBeenCalled();
      expect(prisma.contribution.delete).not.toHaveBeenCalled();
    }
  });

  it('rejects invalid header before reading', async () => {
    const { prisma, service } = createService();
    await expect(
      service.findById('c-1', 'user-a', ['a', 'b']),
    ).rejects.toMatchObject({ response: { code: 'ORGANIZATION_ID_INVALID' } });
    expect(prisma.contribution.findUnique).not.toHaveBeenCalled();
  });
});
