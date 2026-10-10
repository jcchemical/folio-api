import { Test } from '@nestjs/testing';
import { WorkItemStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  foreignWorkItemId,
  identifiedWorkItemId,
  makeWorkItemsPrisma,
  workItemOrgA,
  workItemOrgB,
} from '../../test/fixtures/work-items-prisma.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkItemsService } from './work-items.service.js';

describe('WorkItemsService', () => {
  let state: ReturnType<typeof makeWorkItemsPrisma>;
  let service: WorkItemsService;

  beforeEach(async () => {
    state = makeWorkItemsPrisma();
    const module = await Test.createTestingModule({
      providers: [
        WorkItemsService,
        OrganizationContextResolver,
        OrganizationMembershipService,
        { provide: PrismaService, useValue: state.prisma },
      ],
    }).compile();
    service = module.get(WorkItemsService);
  });

  it('lists only the selected Organization with status and pagination', async () => {
    await service.list('reader', workItemOrgA, {
      status: WorkItemStatus.IDENTIFIED,
      limit: 1,
    });
    expect(state.prisma.workItem.findMany).toHaveBeenCalledWith({
      where: { organizationId: workItemOrgA, status: 'IDENTIFIED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 2,
    });
    const result = await service.list('staff', workItemOrgA);
    expect(result.items.map((row) => row.id)).toEqual([identifiedWorkItemId]);
  });

  it('requires root context and membership before listing', async () => {
    await expect(service.list('staff', undefined)).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_REQUIRED' },
    });
    await expect(service.list('staff', workItemOrgB)).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_MEMBERSHIP_REQUIRED' },
    });
    expect(state.prisma.workItem.findMany).not.toHaveBeenCalled();
  });

  it('creates only a manual unmatched WorkItem with server-owned context', async () => {
    const row = await service.create('staff', workItemOrgA, {
      rawValue: '  original capture  ',
    });
    expect(row).toMatchObject({
      organizationId: workItemOrgA,
      createdById: 'staff',
      source: 'MANUAL',
      status: 'NEEDS_REVIEW',
      matchedItemId: null,
      rawValue: '  original capture  ',
    });
  });

  it('rejects blank captures and Reader creation', async () => {
    await expect(
      service.create('staff', workItemOrgA, { rawValue: ' ' }),
    ).rejects.toMatchObject({
      response: { code: 'VALIDATION_INVALID_REQUEST_DATA' },
    });
    await expect(
      service.create('reader', workItemOrgA, { rawValue: 'x' }),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it('lets Reader read without an Organization header', async () => {
    expect(
      await service.findById(identifiedWorkItemId, 'reader'),
    ).toMatchObject({
      id: identifiedWorkItemId,
    });
  });

  it('masks foreign IDs identically to missing IDs, even with a divergent header', async () => {
    for (const id of [foreignWorkItemId, 'missing']) {
      await expect(
        service.findById(id, 'staff', workItemOrgA),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      await expect(
        service.transition(id, 'staff', WorkItemStatus.VALIDATED, workItemOrgA),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    }
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects malformed headers before reading the resource', async () => {
    await expect(
      service.findById('missing', 'staff', 'invalid'),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ID_INVALID' },
    });
    expect(state.prisma.workItem.findUnique).not.toHaveBeenCalled();
  });

  it('rejects divergent headers for members and Reader transitions', async () => {
    await expect(
      service.findById(identifiedWorkItemId, 'multi', workItemOrgB),
    ).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_CONTEXT_CONFLICT' },
    });
    await expect(
      service.transition(
        identifiedWorkItemId,
        'reader',
        WorkItemStatus.VALIDATED,
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'ORGANIZATION_ROLE_INSUFFICIENT' },
    });
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it.each(['staff', 'admin', 'owner'])(
    'allows %s to validate and preserves the capture and match',
    async (userId) => {
      const original = state.rows.get(identifiedWorkItemId);
      const updated = await service.transition(
        identifiedWorkItemId,
        userId,
        WorkItemStatus.VALIDATED,
      );
      expect(updated).toMatchObject({
        ...original,
        status: WorkItemStatus.VALIDATED,
        updatedAt: expect.any(Date),
      });
      expect(state.prisma.workItem.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          id: identifiedWorkItemId,
          organizationId: workItemOrgA,
          status: 'IDENTIFIED',
        },
        data: { status: 'VALIDATED' },
      });
    },
  );

  it('supports IDENTIFIED -> NEEDS_REVIEW -> VALIDATED', async () => {
    await service.transition(
      identifiedWorkItemId,
      'staff',
      WorkItemStatus.NEEDS_REVIEW,
    );
    expect(
      await service.transition(
        identifiedWorkItemId,
        'staff',
        WorkItemStatus.VALIDATED,
      ),
    ).toMatchObject({
      status: WorkItemStatus.VALIDATED,
    });
  });

  it('rejects self-transitions and transitions out of terminal state', async () => {
    await expect(
      service.transition(
        identifiedWorkItemId,
        'staff',
        WorkItemStatus.IDENTIFIED,
      ),
    ).rejects.toMatchObject({
      response: { code: 'WORK_ITEM_TRANSITION_INVALID' },
    });
    await service.transition(
      identifiedWorkItemId,
      'staff',
      WorkItemStatus.VALIDATED,
    );
    await expect(
      service.transition(
        identifiedWorkItemId,
        'staff',
        WorkItemStatus.NEEDS_REVIEW,
      ),
    ).rejects.toMatchObject({
      response: { code: 'WORK_ITEM_TRANSITION_INVALID' },
    });
    expect(state.prisma.workItem.updateManyAndReturn).toHaveBeenCalledTimes(1);
  });

  it('reports a stable conflict when compare-and-set loses a concurrent update', async () => {
    state.prisma.workItem.updateManyAndReturn.mockResolvedValueOnce([]);
    await expect(
      service.transition(
        identifiedWorkItemId,
        'staff',
        WorkItemStatus.VALIDATED,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'WORK_ITEM_TRANSITION_INVALID' },
    });
  });
});
