import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { WorkItemStatus } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  foreignWorkItemId,
  identifiedWorkItemId,
  itemOrgAId,
  itemOrgBId,
  makeWorkItemsPrisma,
  matchingWorkItemId,
  validatedWorkItemId,
  workItemOrgA,
  workItemOrgB,
} from './fixtures/work-items-prisma.js';

const header = 'X-Folio-Organization-Id';

describe('WorkItems (e2e fake with real JWT guard)', () => {
  let app: INestApplication<App>;
  let tokens: Record<string, string>;
  let state: ReturnType<typeof makeWorkItemsPrisma>;

  beforeEach(async () => {
    state = makeWorkItemsPrisma();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(state.prisma)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = module.get(JwtService);
    tokens = {};
    for (const user of [
      'staff',
      'reader',
      'outsider',
      'multi',
      'admin',
      'owner',
    ]) {
      tokens[user] = await jwt.signAsync({
        sub: user,
        email: `${user}@example.test`,
      });
    }
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires JWT on every route', async () => {
    await request(app.getHttpServer())
      .get('/work-items')
      .set(header, workItemOrgA)
      .expect(401);
    await request(app.getHttpServer())
      .post('/work-items')
      .send({ rawValue: 'x' })
      .expect(401);
    await request(app.getHttpServer())
      .get(`/work-items/${identifiedWorkItemId}`)
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/work-items/${identifiedWorkItemId}/status`)
      .send({ status: 'VALIDATED' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/work-items')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
  });

  it('creates a manual WorkItem, lists, reads and validates it', async () => {
    const created = await request(app.getHttpServer())
      .post('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'captured-code' })
      .expect(201);
    expect(created.body).toMatchObject({
      organizationId: workItemOrgA,
      source: 'MANUAL',
      rawValue: 'captured-code',
      status: 'NEEDS_REVIEW',
      matchedItemId: null,
      createdById: 'staff',
    });
    expect(Object.keys(created.body).sort()).toEqual(
      [
        'id',
        'organizationId',
        'source',
        'rawValue',
        'status',
        'matchedItemId',
        'createdById',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    const listed = await request(app.getHttpServer())
      .get('/work-items?status=NEEDS_REVIEW')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);
    expect(listed.body.items.map((row: { id: string }) => row.id)).toContain(
      created.body.id,
    );
    const detail = await request(app.getHttpServer())
      .get(`/work-items/${created.body.id}`)
      .auth(tokens.reader, { type: 'bearer' })
      .expect(200);
    expect(detail.body).toEqual(created.body);
    const validated = await request(app.getHttpServer())
      .patch(`/work-items/${created.body.id}/status`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ status: 'VALIDATED' })
      .expect(200);
    expect(validated.body.status).toBe('VALIDATED');
    expect(validated.body.matchedItemId).toBeNull();
  });

  it('paginates within the Organization only', async () => {
    await request(app.getHttpServer())
      .post('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'second' })
      .expect(201);
    const first = await request(app.getHttpServer())
      .get('/work-items?status=NEEDS_REVIEW&limit=1')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);
    expect(first.body).toMatchObject({
      hasMore: true,
      nextCursor: matchingWorkItemId,
    });
    const second = await request(app.getHttpServer())
      .get(
        `/work-items?status=NEEDS_REVIEW&limit=1&cursor=${first.body.nextCursor}`,
      )
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);
    expect(second.body).toMatchObject({ hasMore: false, nextCursor: null });
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].organizationId).toBe(workItemOrgA);
    expect(second.body.items[0].id).not.toBe(matchingWorkItemId);
  });

  it('uses the default page size and returns the standard pagination shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/work-items')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);

    expect(state.prisma.workItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 26 }),
    );
    expect(response.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        nextCursor: null,
        hasMore: false,
      }),
    );
  });

  it('requires unmatching before returning a matched WorkItem to NEEDS_REVIEW', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/work-items/${identifiedWorkItemId}/status`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ status: 'NEEDS_REVIEW' })
      .expect(409);

    expect(response.body.code).toBe('WORK_ITEM_TRANSITION_INVALID');
    expect(state.rows.get(identifiedWorkItemId)).toMatchObject({
      matchedItemId: `c${'3'.repeat(24)}`,
      status: WorkItemStatus.IDENTIFIED,
    });
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects a page size above the maximum before listing', async () => {
    const response = await request(app.getHttpServer())
      .get('/work-items?limit=101')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.findMany).not.toHaveBeenCalled();
  });

  it('accepts the maximum page size', async () => {
    const response = await request(app.getHttpServer())
      .get('/work-items?limit=100')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);

    expect(state.prisma.workItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    );
    expect(response.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        nextCursor: null,
        hasMore: false,
      }),
    );
  });

  it('requires root context and refuses non-member root selection', async () => {
    const missing = await request(app.getHttpServer())
      .get('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .expect(400);
    expect(missing.body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED');
    await request(app.getHttpServer())
      .post('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .send({ rawValue: 'x' })
      .expect(400);
    const forbidden = await request(app.getHttpServer())
      .get('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgB)
      .expect(403);
    expect(forbidden.body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED');
  });

  it('rejects malformed Organization headers on root list and create routes', async () => {
    const list = await request(app.getHttpServer())
      .get('/work-items')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, 'malformed')
      .expect(400);
    expect(list.body.code).toBe('ORGANIZATION_ID_INVALID');

    const create = await request(app.getHttpServer())
      .post('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, 'malformed')
      .send({ rawValue: 'x' })
      .expect(400);
    expect(create.body.code).toBe('ORGANIZATION_ID_INVALID');
    expect(state.prisma.workItem.findMany).not.toHaveBeenCalled();
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it('allows Reader reads but blocks creation and transitions', async () => {
    await request(app.getHttpServer())
      .get(`/work-items/${identifiedWorkItemId}`)
      .auth(tokens.reader, { type: 'bearer' })
      .expect(200);
    for (const route of [
      '/work-items',
      `/work-items/${identifiedWorkItemId}/status`,
    ]) {
      const call =
        route === '/work-items'
          ? request(app.getHttpServer()).post(route).send({ rawValue: 'x' })
          : request(app.getHttpServer())
              .patch(route)
              .send({ status: 'VALIDATED' });
      const response = await call
        .auth(tokens.reader, { type: 'bearer' })
        .set(header, workItemOrgA)
        .expect(403);
      expect(response.body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT');
    }
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('masks cross-tenant detail and transitions as missing resources before header comparison', async () => {
    for (const id of [foreignWorkItemId, 'missing']) {
      for (const organization of [undefined, workItemOrgA, workItemOrgB]) {
        const get = request(app.getHttpServer())
          .get(`/work-items/${id}`)
          .auth(tokens.staff, { type: 'bearer' });
        if (organization) get.set(header, organization);
        const read = await get.expect(404);
        const patch = request(app.getHttpServer())
          .patch(`/work-items/${id}/status`)
          .auth(tokens.staff, { type: 'bearer' })
          .send({ status: 'VALIDATED' });
        if (organization) patch.set(header, organization);
        const write = await patch.expect(404);
        expect(read.body.code).toBe('RESOURCE_NOT_FOUND');
        expect(write.body).toEqual(read.body);
      }
    }
    expect(state.rows.get(foreignWorkItemId)?.status).toBe(
      WorkItemStatus.NEEDS_REVIEW,
    );
  });

  it('rejects mismatching member headers and malformed headers', async () => {
    const conflict = await request(app.getHttpServer())
      .get(`/work-items/${identifiedWorkItemId}`)
      .auth(tokens.multi, { type: 'bearer' })
      .set(header, workItemOrgB)
      .expect(409);
    expect(conflict.body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT');
    for (const id of [identifiedWorkItemId, 'missing']) {
      const invalid = await request(app.getHttpServer())
        .get(`/work-items/${id}`)
        .auth(tokens.staff, { type: 'bearer' })
        .set(header, 'invalid')
        .expect(400);
      expect(invalid.body.code).toBe('ORGANIZATION_ID_INVALID');
    }
  });

  it('rejects a mismatching Organization header on a transition', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/work-items/${identifiedWorkItemId}/status`)
      .auth(tokens.multi, { type: 'bearer' })
      .set(header, workItemOrgB)
      .send({ status: 'VALIDATED' })
      .expect(409);

    expect(response.body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('scans an opaque value exactly and creates no catalog or inventory record', async () => {
    const rawValue = '  978-0-306-40615-7 \t';
    const response = await request(app.getHttpServer())
      .post('/work-items/scan')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue })
      .expect(201);

    expect(response.body).toMatchObject({
      organizationId: workItemOrgA,
      source: 'SCAN',
      status: 'NEEDS_REVIEW',
      matchedItemId: null,
      rawValue,
      createdById: 'staff',
    });
    expect(state.prisma.workItem.create).toHaveBeenCalledWith({
      data: {
        organizationId: workItemOrgA,
        createdById: 'staff',
        source: 'SCAN',
        status: 'NEEDS_REVIEW',
        rawValue,
      },
    });
    expect(state.prisma.item.findUnique).not.toHaveBeenCalled();
    expect(state.prisma.item.create).not.toHaveBeenCalled();
  });

  it.each(['admin', 'owner'])('allows %s to scan a WorkItem', async (user) => {
    const response = await request(app.getHttpServer())
      .post('/work-items/scan')
      .auth(tokens[user], { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: `${user}-raw` })
      .expect(201);

    expect(response.body).toMatchObject({
      source: 'SCAN',
      status: 'NEEDS_REVIEW',
      matchedItemId: null,
      rawValue: `${user}-raw`,
    });
  });

  it('blocks Reader scans and rejects malformed scan context', async () => {
    const forbidden = await request(app.getHttpServer())
      .post('/work-items/scan')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'raw' })
      .expect(403);
    expect(forbidden.body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT');

    const invalidHeader = await request(app.getHttpServer())
      .post('/work-items/scan')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, 'bad')
      .send({ rawValue: 'raw' })
      .expect(400);
    expect(invalidHeader.body.code).toBe('ORGANIZATION_ID_INVALID');
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])(
    'rejects missing or blank scan values: %s',
    async (rawValue) => {
      const body = rawValue === undefined ? {} : { rawValue };
      const response = await request(app.getHttpServer())
        .post('/work-items/scan')
        .auth(tokens.staff, { type: 'bearer' })
        .set(header, workItemOrgA)
        .send(body)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
      expect(state.prisma.workItem.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    'id',
    'organizationId',
    'source',
    'status',
    'createdById',
    'createdAt',
    'updatedAt',
    'matchedItemId',
    'matchedItem',
    'organization',
    'createdBy',
  ])('rejects scan field %s without creating a WorkItem', async (field) => {
    const response = await request(app.getHttpServer())
      .post('/work-items/scan')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'raw', [field]: 'forged' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown scan field without creating a WorkItem', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/work-items/scan')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'raw', extra: true })
      .expect(400);
    expect(unknown.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it('manually matches a same-Organization Item and moves to IDENTIFIED', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(200);

    expect(response.body).toMatchObject({
      matchedItemId: itemOrgAId,
      status: 'IDENTIFIED',
    });
    expect(state.prisma.workItem.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: matchingWorkItemId,
        organizationId: workItemOrgA,
        status: 'NEEDS_REVIEW',
        matchedItemId: null,
      },
      data: { matchedItemId: itemOrgAId, status: 'IDENTIFIED' },
    });
  });

  it.each(['admin', 'owner'])(
    'allows %s to match an existing Item',
    async (user) => {
      const response = await request(app.getHttpServer())
        .patch(`/work-items/${matchingWorkItemId}/match`)
        .auth(tokens[user], { type: 'bearer' })
        .send({ itemId: itemOrgAId })
        .expect(200);
      expect(response.body).toMatchObject({
        matchedItemId: itemOrgAId,
        status: 'IDENTIFIED',
      });
    },
  );

  it('allows an unmatched IDENTIFIED WorkItem to receive its first match', async () => {
    const row = state.rows.get(matchingWorkItemId)!;
    state.rows.set(matchingWorkItemId, {
      ...row,
      status: WorkItemStatus.IDENTIFIED,
    });

    const response = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(200);
    expect(response.body).toMatchObject({
      matchedItemId: itemOrgAId,
      status: 'IDENTIFIED',
    });
  });

  it('blocks Reader matching and returns not found for missing or foreign Items', async () => {
    const forbidden = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.reader, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(403);
    expect(forbidden.body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT');

    for (const itemId of ['missing-item', itemOrgBId]) {
      const response = await request(app.getHttpServer())
        .patch(`/work-items/${matchingWorkItemId}/match`)
        .auth(tokens.staff, { type: 'bearer' })
        .send({ itemId })
        .expect(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
      expect(state.rows.get(matchingWorkItemId)).toMatchObject({
        matchedItemId: null,
        status: WorkItemStatus.NEEDS_REVIEW,
      });
    }
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('masks foreign WorkItems and rejects a divergent match header', async () => {
    const foreign = await request(app.getHttpServer())
      .patch(`/work-items/${foreignWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgBId })
      .expect(404);
    expect(foreign.body.code).toBe('RESOURCE_NOT_FOUND');

    const conflict = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.multi, { type: 'bearer' })
      .set(header, workItemOrgB)
      .send({ itemId: itemOrgAId })
      .expect(409);
    expect(conflict.body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects matching validated or already matched WorkItems', async () => {
    const validated = await request(app.getHttpServer())
      .patch(`/work-items/${validatedWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(409);
    expect(validated.body.code).toBe('WORK_ITEM_MATCH_INVALID_STATE');

    const alreadyMatched = await request(app.getHttpServer())
      .patch(`/work-items/${identifiedWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(409);
    expect(alreadyMatched.body.code).toBe('WORK_ITEM_MATCH_ALREADY_PRESENT');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects an empty match body', async () => {
    const missingItem = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({})
      .expect(400);
    expect(missingItem.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it.each([
    'id',
    'organizationId',
    'source',
    'status',
    'createdById',
    'createdAt',
    'updatedAt',
    'matchedItem',
    'organization',
    'createdBy',
    'rawValue',
  ])('rejects match field %s without updating', async (field) => {
    const response = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId, [field]: 'forged' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects an unknown match field without updating', async () => {
    const unknown = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId, extra: true })
      .expect(400);
    expect(unknown.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects a lost concurrent match compare-and-set without writing a match', async () => {
    state.prisma.workItem.updateManyAndReturn.mockResolvedValueOnce([]);

    const response = await request(app.getHttpServer())
      .patch(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(409);

    expect(response.body.code).toBe('WORK_ITEM_MATCH_INVALID_STATE');
    expect(state.rows.get(matchingWorkItemId)).toMatchObject({
      matchedItemId: null,
      status: WorkItemStatus.NEEDS_REVIEW,
    });
  });

  it('removes an existing match and returns the WorkItem to NEEDS_REVIEW', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/work-items/${identifiedWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .expect(200);

    expect(response.body).toMatchObject({
      matchedItemId: null,
      status: 'NEEDS_REVIEW',
    });
    expect(state.prisma.workItem.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: identifiedWorkItemId,
        organizationId: workItemOrgA,
        status: 'IDENTIFIED',
        matchedItemId: `c${'3'.repeat(24)}`,
      },
      data: { matchedItemId: null, status: 'NEEDS_REVIEW' },
    });
  });

  it('rejects removing a missing match or a match from a validated WorkItem', async () => {
    const absent = await request(app.getHttpServer())
      .delete(`/work-items/${matchingWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .expect(409);
    expect(absent.body.code).toBe('WORK_ITEM_MATCH_NOT_PRESENT');

    const validated = await request(app.getHttpServer())
      .delete(`/work-items/${validatedWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .expect(409);
    expect(validated.body.code).toBe('WORK_ITEM_MATCH_INVALID_STATE');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('blocks Reader unmatching and checks a divergent unmatch header', async () => {
    const forbidden = await request(app.getHttpServer())
      .delete(`/work-items/${identifiedWorkItemId}/match`)
      .auth(tokens.reader, { type: 'bearer' })
      .expect(403);
    expect(forbidden.body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT');

    const conflict = await request(app.getHttpServer())
      .delete(`/work-items/${identifiedWorkItemId}/match`)
      .auth(tokens.multi, { type: 'bearer' })
      .set(header, workItemOrgB)
      .expect(409);
    expect(conflict.body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects request fields on DELETE match without updating', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/work-items/${identifiedWorkItemId}/match`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ itemId: itemOrgAId })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('filters NEEDS_REVIEW and IDENTIFIED rows within the selected Organization', async () => {
    const needsReview = await request(app.getHttpServer())
      .get('/work-items?status=NEEDS_REVIEW')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);
    expect(
      needsReview.body.items.map((row: { id: string }) => row.id),
    ).toContain(matchingWorkItemId);
    expect(
      needsReview.body.items.every(
        (row: { organizationId: string }) =>
          row.organizationId === workItemOrgA,
      ),
    ).toBe(true);

    const identified = await request(app.getHttpServer())
      .get('/work-items?status=IDENTIFIED')
      .auth(tokens.reader, { type: 'bearer' })
      .set(header, workItemOrgA)
      .expect(200);
    expect(
      identified.body.items.map((row: { id: string }) => row.id),
    ).toContain(identifiedWorkItemId);
    expect(identified.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        nextCursor: null,
        hasMore: false,
      }),
    );
  });

  it('supports the identified review path and refuses invalid/terminal transitions', async () => {
    const identified = state.rows.get(identifiedWorkItemId)!;
    state.rows.set(identifiedWorkItemId, {
      ...identified,
      matchedItemId: null,
    });
    for (const status of [
      'IDENTIFIED',
      'NEEDS_REVIEW',
      'VALIDATED',
      'NEEDS_REVIEW',
      'VALIDATED',
    ]) {
      const invalid =
        status === 'IDENTIFIED' ||
        state.rows.get(identifiedWorkItemId)?.status === 'VALIDATED';
      const result = await request(app.getHttpServer())
        .patch(`/work-items/${identifiedWorkItemId}/status`)
        .auth(tokens.staff, { type: 'bearer' })
        .send({ status })
        .expect(invalid ? 409 : 200);
      if (invalid)
        expect(result.body.code).toBe('WORK_ITEM_TRANSITION_INVALID');
      else expect(result.body.status).toBe(status);
    }
  });

  it.each(['admin', 'owner'])(
    'permits %s to transition identified -> validated',
    async (user) => {
      const result = await request(app.getHttpServer())
        .patch(`/work-items/${identifiedWorkItemId}/status`)
        .auth(tokens[user], { type: 'bearer' })
        .send({ status: 'VALIDATED' })
        .expect(200);
      expect(result.body.status).toBe('VALIDATED');
      expect(result.body.matchedItemId).toBe(`c${'3'.repeat(24)}`);
    },
  );

  it('validates bodies and queries and forbids server-owned fields', async () => {
    for (const body of [
      {},
      { rawValue: ' ' },
      { rawValue: 123 },
      { rawValue: null },
    ]) {
      await request(app.getHttpServer())
        .post('/work-items')
        .auth(tokens.staff, { type: 'bearer' })
        .set(header, workItemOrgA)
        .send(body)
        .expect(400);
    }
    for (const field of [
      'organizationId',
      'createdById',
      'source',
      'status',
      'matchedItemId',
      'rawValue',
    ]) {
      const response = await request(app.getHttpServer())
        .patch(`/work-items/${identifiedWorkItemId}/status`)
        .auth(tokens.staff, { type: 'bearer' })
        .send(
          field === 'status'
            ? { status: 'UNKNOWN' }
            : { status: 'VALIDATED', [field]: 'forged' },
        )
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    }
    for (const query of [
      'status=UNKNOWN',
      'limit=0',
      'cursor=invalid',
      `organizationId=${workItemOrgB}`,
    ]) {
      await request(app.getHttpServer())
        .get(`/work-items?${query}`)
        .auth(tokens.reader, { type: 'bearer' })
        .set(header, workItemOrgA)
        .expect(400);
    }
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it.each([
    'id',
    'organizationId',
    'source',
    'status',
    'matchedItemId',
    'createdById',
    'createdAt',
    'updatedAt',
    'matchedItem',
    'organization',
    'createdBy',
  ])('rejects POST field %s without writing', async (field) => {
    const response = await request(app.getHttpServer())
      .post('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'x', [field]: 'forged' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown POST property without writing', async () => {
    const response = await request(app.getHttpServer())
      .post('/work-items')
      .auth(tokens.staff, { type: 'bearer' })
      .set(header, workItemOrgA)
      .send({ rawValue: 'x', extra: 'y' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.create).not.toHaveBeenCalled();
  });

  it.each([
    'rawValue',
    'source',
    'matchedItemId',
    'createdById',
    'organizationId',
    'id',
    'createdAt',
    'updatedAt',
    'matchedItem',
    'organization',
    'createdBy',
  ])('rejects PATCH field %s without updating', async (field) => {
    const response = await request(app.getHttpServer())
      .patch(`/work-items/${identifiedWorkItemId}/status`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ status: 'VALIDATED', [field]: 'forged' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects an unknown PATCH property without updating', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/work-items/${identifiedWorkItemId}/status`)
      .auth(tokens.staff, { type: 'bearer' })
      .send({ status: 'VALIDATED', extra: 'y' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_INVALID_BODY');
    expect(state.prisma.workItem.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it.each(['admin', 'owner'])(
    'allows %s to create a manual WorkItem',
    async (user) => {
      const response = await request(app.getHttpServer())
        .post('/work-items')
        .auth(tokens[user], { type: 'bearer' })
        .set(header, workItemOrgA)
        .send({ rawValue: `${user}-capture` })
        .expect(201);

      expect(response.body).toMatchObject({
        source: 'MANUAL',
        status: 'NEEDS_REVIEW',
        matchedItemId: null,
        createdById: user,
      });
    },
  );
});
