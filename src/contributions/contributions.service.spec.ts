import { ForbiddenException } from '@nestjs/common';
import { AgentKind, OrganizationRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { ContributionsService } from './contributions.service.js';

const workA = { id: 'work-a', organizationId: 'org-a' };
const workB = { id: 'work-b', organizationId: 'org-b' };
const editionA = { id: 'edition-a', workId: workA.id, work: workA };
const agentA = { id: 'agent-a', organizationId: 'org-a' };

function createService() {
  const tx = {
    work: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === workB.id
              ? workB
              : where.id === workA.id
                ? workA
                : null,
          ),
        ),
    },
    edition: {
      findUnique: vi.fn().mockResolvedValue(editionA),
    },
    agent: {
      findUnique: vi.fn().mockResolvedValue(agentA),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(agentA),
    },
    contribution: {
      create: vi.fn().mockResolvedValue({ id: 'contribution-a' }),
    },
  };
  const prisma = {
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const contexts = {
    resolveDerivedContext: vi.fn().mockResolvedValue({
      organizationId: 'org-a',
      role: OrganizationRole.STAFF,
    }),
  } as unknown as OrganizationContextResolver;
  return {
    tx,
    prisma,
    contexts,
    service: new ContributionsService(prisma, contexts),
  };
}

const agentDraft = { kind: AgentKind.PERSON, displayName: 'Doe, Jane' };

describe('ContributionsService canonical target and tenant rules', () => {
  it('creates a manual Work Contribution with server-controlled MANUAL source', async () => {
    const { tx, contexts, service } = createService();

    await service.createManual('user-a', {
      workId: workA.id,
      agent: agentDraft,
    });

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: workA.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(tx.agent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: workA.organizationId,
        kind: AgentKind.PERSON,
        displayName: 'Doe, Jane',
        normalizedDisplayName: 'doe, jane',
      }),
    });
    expect(tx.contribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workId: workA.id,
          source: 'MANUAL',
          agentId: agentA.id,
        }),
      }),
    );
  });

  it('creates an Edition Contribution by deriving its tenant through Edition to Work', async () => {
    const { tx, contexts, service } = createService();

    await service.createManual(
      'user-a',
      {
        editionId: editionA.id,
        agent: agentDraft,
      },
      'org-a',
    );

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: 'org-a',
      derivedOrganizationId: workA.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(tx.contribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          editionId: editionA.id,
          source: 'MANUAL',
        }),
      }),
    );
  });

  it('rejects missing and competing Work/Edition targets before writes', async () => {
    const missing = createService();
    await expect(
      missing.service.createManual('user-a', { agent: agentDraft }),
    ).rejects.toMatchObject({ status: 400 });
    expect(missing.tx.contribution.create).not.toHaveBeenCalled();

    const both = createService();
    await expect(
      both.service.createManual('user-a', {
        workId: workA.id,
        editionId: editionA.id,
        agent: agentDraft,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(both.tx.contribution.create).not.toHaveBeenCalled();
  });

  it('rejects an Agent from another Organization', async () => {
    const { tx, service } = createService();
    tx.agent.findUnique.mockResolvedValue({
      id: 'agent-b',
      organizationId: 'org-b',
    });

    await expect(
      service.createManual('user-a', { workId: workA.id, agentId: 'agent-b' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'CONFLICT_AGENT_ORGANIZATION_MISMATCH' },
    });
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('rejects a target from another Organization before creating or attaching an Agent', async () => {
    const { tx, contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      service.createManual('user-a', { workId: workB.id, agent: agentDraft }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.agent.create).not.toHaveBeenCalled();
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('rejects a mismatching optional header before creating an Agent or Contribution', async () => {
    const { tx, contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 409,
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });

    await expect(
      service.createManual(
        'user-a',
        { workId: workA.id, agent: agentDraft },
        'org-b',
      ),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    expect(tx.agent.create).not.toHaveBeenCalled();
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('rejects READER role before mutation', async () => {
    const { tx, contexts, service } = createService();
    vi.mocked(contexts.resolveDerivedContext).mockRejectedValueOnce({
      status: 403,
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });

    await expect(
      service.createManual('reader', { workId: workA.id, agent: agentDraft }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(tx.agent.create).not.toHaveBeenCalled();
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('preserves PORBASE source parts in their supplied order and fixes source on the server', async () => {
    const { tx, contexts, service } = createService();
    const parts = [
      { code: 'a', value: 'Doe, Jane', sortOrder: 0 },
      { code: '4', value: '070', sortOrder: 1 },
      { code: 'a', value: 'Repeated literal', sortOrder: 2 },
    ];

    await service.persistPorbase(tx as never, 'user-a', workA.id, [
      {
        targetScope: 'WORK',
        kind: AgentKind.PERSON,
        displayName: 'Doe, Jane',
        sourceTag: '700',
        indicator1: '1',
        indicator2: ' ',
        sourceParts: parts,
        sortOrder: 0,
      },
    ]);

    expect(contexts.resolveDerivedContext).toHaveBeenCalledWith({
      userId: 'user-a',
      headerValue: undefined,
      derivedOrganizationId: workA.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    expect(tx.contribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'PORBASE',
          sourceTag: '700',
          indicator1: '1',
          indicator2: ' ',
          sourceParts: { create: parts },
        }),
      }),
    );
  });
});
