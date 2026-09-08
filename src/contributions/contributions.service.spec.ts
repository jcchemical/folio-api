import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { AgentKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ContributionsService } from './contributions.service.js';

function transactionMock() {
  return {
    work: { findUnique: vi.fn().mockResolvedValue({ id: 'work-1', organizationId: 'org-1' }) },
    edition: { findUnique: vi.fn() },
    agent: {
      findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'agent-new', organizationId: 'org-1' }),
    },
    contribution: { create: vi.fn().mockResolvedValue({ id: 'contribution-1' }) },
  };
}

describe('ContributionsService', () => {
  it('creates a MANUAL contribution with a same-organization Agent draft', async () => {
    const tx = transactionMock();
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const memberships = { assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined) };
    const service = new ContributionsService(prisma as never, memberships as never);

    await service.createManual('user-1', { workId: 'work-1', agent: { kind: 'PERSON', displayName: 'Doe, Jane' } });

    expect(tx.agent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ organizationId: 'org-1', kind: AgentKind.PERSON, normalizedDisplayName: 'doe, jane' }) });
    expect(tx.contribution.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: 'MANUAL', workId: 'work-1' }) }));
  });

  it('rejects an Agent from another organization with the stable conflict', async () => {
    const tx = transactionMock();
    tx.agent.findUnique.mockResolvedValue({ id: 'agent-2', organizationId: 'org-2' });
    const service = new ContributionsService({ $transaction: vi.fn((callback) => callback(tx)) } as never, { assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await expect(service.createManual('user-1', { workId: 'work-1', agentId: 'agent-2' })).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({ code: 'CONFLICT_AGENT_ORGANIZATION_MISMATCH' }),
    });
  });

  it('checks target authorization before attaching a contribution', async () => {
    const tx = transactionMock();
    const service = new ContributionsService({ $transaction: vi.fn((callback) => callback(tx)) } as never, { assertWorkWriteAccess: vi.fn().mockRejectedValue(new ForbiddenException()) } as never);
    await expect(service.createManual('user-1', { workId: 'work-1', agent: { kind: 'PERSON', displayName: 'Doe, Jane' } })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates another Agent when exact-name reuse is ambiguous', async () => {
    const tx = transactionMock();
    tx.agent.findMany.mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]);
    const service = new ContributionsService({ $transaction: vi.fn((callback) => callback(tx)) } as never, { assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined) } as never);
    await service.createManual('user-1', { workId: 'work-1', agent: { kind: 'PERSON', displayName: 'Doe, Jane' } });
    expect(tx.agent.create).toHaveBeenCalledTimes(1);
  });

  it('reuses an exact Agent only within the resolved target organization', async () => {
    const tx = transactionMock();
    tx.agent.findMany
      .mockResolvedValueOnce([{ id: 'agent-org-1', organizationId: 'org-1' }])
      .mockResolvedValueOnce([]);
    tx.work.findUnique
      .mockResolvedValueOnce({ id: 'work-1', organizationId: 'org-1' })
      .mockResolvedValueOnce({ id: 'work-2', organizationId: 'org-2' });
    const service = new ContributionsService({ $transaction: vi.fn((callback) => callback(tx)) } as never, { assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined) } as never);

    await service.createManual('user-1', { workId: 'work-1', agent: { kind: 'PERSON', displayName: 'Doe, Jane' } });
    await service.createManual('user-1', { workId: 'work-2', agent: { kind: 'PERSON', displayName: 'Doe, Jane' } });

    expect(tx.agent.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { organizationId: 'org-1', kind: AgentKind.PERSON, normalizedDisplayName: 'doe, jane' } }));
    expect(tx.agent.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { organizationId: 'org-2', kind: AgentKind.PERSON, normalizedDisplayName: 'doe, jane' } }));
    expect(tx.agent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ organizationId: 'org-2' }) });
  });

  it('rejects malformed PORBASE source metadata', async () => {
    const tx = transactionMock();
    const service = new ContributionsService({} as never, { assertWorkWriteAccess: vi.fn().mockResolvedValue(undefined) } as never);
    await expect(service.persistPorbase(tx as never, 'user-1', 'work-1', [{
      targetScope: 'WORK', kind: AgentKind.PERSON, displayName: 'Doe, Jane', sourceTag: '700', indicator1: '', indicator2: ' ', sourceParts: [], sortOrder: 0,
    }])).rejects.toThrow('PORBASE contribution source metadata is invalid');
  });
});