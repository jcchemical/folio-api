import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const orgA = `c${'a'.repeat(24)}`;
const orgB = `c${'b'.repeat(24)}`;
const workAId = `c${'1'.repeat(24)}`;
const workBId = `c${'2'.repeat(24)}`;
const editionAId = `c${'3'.repeat(24)}`;
const editionBId = `c${'4'.repeat(24)}`;
const agentAId = `c${'5'.repeat(24)}`;
const agentBId = `c${'6'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

type Work = { id: string; organizationId: string };
type Edition = { id: string; workId: string; work: Work };
type Agent = {
  id: string;
  organizationId: string;
  kind: string;
  displayName: string;
  normalizedDisplayName: string;
};

describe('Canonical Contribution route (e2e)', () => {
  let app: INestApplication<App>;
  let currentUserId = 'user-a';
  let rows: Array<Record<string, unknown>>;
  let agentMap: Map<string, Agent>;
  let workMap: Map<string, Work>;
  let editionMap: Map<string, Edition>;

  beforeEach(async () => {
    currentUserId = 'user-a';
    rows = [];
    workMap = new Map([
      [workAId, { id: workAId, organizationId: orgA }],
      [workBId, { id: workBId, organizationId: orgB }],
    ]);
    editionMap = new Map([
      [
        editionAId,
        { id: editionAId, workId: workAId, work: workMap.get(workAId)! },
      ],
      [
        editionBId,
        { id: editionBId, workId: workBId, work: workMap.get(workBId)! },
      ],
    ]);
    agentMap = new Map([
      [
        agentAId,
        {
          id: agentAId,
          organizationId: orgA,
          kind: 'PERSON',
          displayName: 'Agent A',
          normalizedDisplayName: 'agent a',
        },
      ],
      [
        agentBId,
        {
          id: agentBId,
          organizationId: orgB,
          kind: 'PERSON',
          displayName: 'Agent B',
          normalizedDisplayName: 'agent b',
        },
      ],
    ]);
    const organizations = new Map([
      [orgA, { id: orgA, name: 'Organization A' }],
      [orgB, { id: orgB, name: 'Organization B' }],
    ]);
    const membershipRows = [
      { userId: 'user-a', organizationId: orgA, role: 'OWNER' },
      { userId: 'user-a', organizationId: orgB, role: 'STAFF' },
      { userId: 'user-b', organizationId: orgB, role: 'READER' },
    ];
    let generatedAgent = 0;
    let generatedContribution = 0;

    const expand = (row: Record<string, unknown>) => ({
      ...row,
      agent: agentMap.get(String(row.agentId)),
      sourceParts: [],
      work: row.workId ? workMap.get(String(row.workId)) : null,
      edition: row.editionId ? editionMap.get(String(row.editionId)) : null,
    });
    const ownerOf = (row: ReturnType<typeof expand>) =>
      (row.work ?? row.edition?.work)?.organizationId;

    const prisma = {
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          organizations.get(where.id) ?? null,
      },
      organizationMembership: {
        findUnique: async ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const key = where.userId_organizationId;
          const membership = membershipRows.find(
            (row) =>
              row.userId === key.userId &&
              row.organizationId === key.organizationId,
          );
          return membership
            ? {
                ...membership,
                organization: organizations.get(key.organizationId),
              }
            : null;
        },
      },
      work: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          workMap.get(where.id) ?? null,
      },
      edition: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          editionMap.get(where.id) ?? null,
      },
      agent: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          agentMap.get(where.id) ?? null,
        findMany: async ({
          where,
        }: {
          where: {
            organizationId: string;
            kind: string;
            normalizedDisplayName: string;
          };
        }) =>
          [...agentMap.values()]
            .filter(
              (agent) =>
                agent.organizationId === where.organizationId &&
                agent.kind === where.kind &&
                agent.normalizedDisplayName === where.normalizedDisplayName,
            )
            .slice(0, 2),
        create: async ({ data }: { data: Omit<Agent, 'id'> }) => {
          generatedAgent += 1;
          const agent = {
            id: `c${generatedAgent.toString().padStart(24, '0')}`,
            ...data,
          };
          agentMap.set(agent.id, agent);
          return agent;
        },
      },
      contribution: {
        create: async ({
          data,
          include,
        }: {
          data: Record<string, unknown>;
          include: unknown;
        }) => {
          generatedContribution += 1;
          const row = {
            id: `c${(100 + generatedContribution).toString().padStart(24, '0')}`,
            createdAt: new Date(2026, 0, generatedContribution),
            ...data,
          };
          rows.push(row);
          return {
            ...row,
            agent: agentMap.get(String(data.agentId)),
            sourceParts: [],
            include,
          };
        },
        findUnique: async ({ where }: { where: { id: string } }) => {
          const row = rows.find((entry) => entry.id === where.id);
          return row ? expand(row) : null;
        },
        findMany: async ({
          where,
          take,
          cursor,
          skip,
        }: {
          where: {
            AND: Array<
              | { OR: Array<{ work?: { organizationId: string } }> }
              | Record<string, string>
            >;
          };
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          const organizationId = (
            where.AND[0] as { OR: Array<{ work: { organizationId: string } }> }
          ).OR[0].work.organizationId;
          const filters = where.AND.slice(1) as Array<Record<string, string>>;
          let found = rows
            .map(expand)
            .filter(
              (row) =>
                ownerOf(row) === organizationId &&
                filters.every((filter) =>
                  Object.entries(filter).every(
                    ([key, value]) => row[key] === value,
                  ),
                ),
            )
            .sort(
              (left, right) =>
                (right.createdAt as Date).getTime() -
                (left.createdAt as Date).getTime(),
            );
          if (cursor) {
            const index = found.findIndex((row) => row.id === cursor.id);
            found = index < 0 ? [] : found.slice(index + (skip ?? 0));
          }
          return found.slice(0, take);
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = rows.find((entry) => entry.id === where.id)!;
          Object.assign(row, data);
          return expand(row);
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const index = rows.findIndex((entry) => entry.id === where.id);
          const [row] = rows.splice(index, 1);
          return expand(row);
        },
      },
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback(prisma),
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { id: currentUserId };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 20_000);

  afterEach(async () => app.close());

  const manualAgentDraft = { kind: 'PERSON', displayName: 'New Local Agent' };

  it('creates Work and Edition Contributions from exactly one persisted target', async () => {
    const workResult = await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, agentId: agentAId })
      .expect(201);
    expect(workResult.body).toMatchObject({
      workId: workAId,
      source: 'MANUAL',
    });

    const editionResult = await request(app.getHttpServer())
      .post('/contributions')
      .set(header, orgA)
      .send({
        editionId: editionAId,
        agent: manualAgentDraft,
        roleLabel: 'author',
      })
      .expect(201);
    expect(editionResult.body).toMatchObject({
      editionId: editionAId,
      source: 'MANUAL',
    });
    expect(editionResult.body.agent).toMatchObject({
      organizationId: orgA,
      displayName: manualAgentDraft.displayName,
    });
    expect(rows).toHaveLength(2);
  });

  it('enforces XOR targets and rejects client-controlled source/provenance metadata', async () => {
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ agent: manualAgentDraft })
      .expect(400);
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, editionId: editionAId, agent: manualAgentDraft })
      .expect(400);
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, agent: manualAgentDraft, source: 'PORBASE' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    expect(rows).toEqual([]);
  });

  it('rejects a header mismatch and cross-organization Agent/target pairing before mutation', async () => {
    await request(app.getHttpServer())
      .post('/contributions')
      .set(header, orgB)
      .send({ workId: workAId, agent: manualAgentDraft })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, agentId: agentBId })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CONFLICT_AGENT_ORGANIZATION_MISMATCH'),
      );
    expect(rows).toEqual([]);
  });

  it('isolates memberships and rejects READER writes before creating Agents or Contributions', async () => {
    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, agent: manualAgentDraft })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workBId, agent: manualAgentDraft })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    expect(rows).toEqual([]);
    expect(
      [...agentMap.values()].filter(
        (agent) => agent.displayName === manualAgentDraft.displayName,
      ),
    ).toEqual([]);
  });

  async function seed() {
    const ids: string[] = [];
    for (const body of [
      { workId: workAId, agentId: agentAId, roleLabel: 'author' },
      { editionId: editionAId, agentId: agentAId, roleLabel: 'editor' },
    ]) {
      const { body: created } = await request(app.getHttpServer())
        .post('/contributions')
        .send(body)
        .expect(201);
      ids.push(created.id);
    }
    currentUserId = 'user-b';
    const { body: inB } = await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workBId, agentId: agentBId })
      .expect(403);
    expect(inB.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT');
    currentUserId = 'user-a';
    const { body: createdB } = await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workBId, agentId: agentBId })
      .expect(201);
    ids.push(createdB.id);
    return ids;
  }

  it('lists only the explicit Organization with filters and cursor pagination', async () => {
    const [workContribution, editionContribution, orgBContribution] =
      await seed();
    await request(app.getHttpServer())
      .get('/contributions')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/contributions')
      .set(header, orgA)
      .query({ organizationId: orgB })
      .expect(400);

    const first = await request(app.getHttpServer())
      .get('/contributions')
      .set(header, orgA)
      .query({ limit: 1 })
      .expect(200);
    expect(first.body.items.map((row: { id: string }) => row.id)).toEqual([
      editionContribution,
    ]);
    expect(first.body.hasMore).toBe(true);
    const second = await request(app.getHttpServer())
      .get('/contributions')
      .set(header, orgA)
      .query({ limit: 1, cursor: first.body.nextCursor })
      .expect(200);
    expect(second.body.items.map((row: { id: string }) => row.id)).toEqual([
      workContribution,
    ]);
    expect(second.body.hasMore).toBe(false);

    await request(app.getHttpServer())
      .get('/contributions')
      .set(header, orgA)
      .query({ workId: workAId })
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: { id: string }) => row.id)).toEqual([
          workContribution,
        ]),
      );
    await request(app.getHttpServer())
      .get('/contributions')
      .set(header, orgB)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: { id: string }) => row.id)).toEqual([
          orgBContribution,
        ]),
      );
    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .get('/contributions')
      .set(header, orgA)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('fetches by id for members and masks other Organizations as RESOURCE_NOT_FOUND', async () => {
    const [workContribution, , orgBContribution] = await seed();
    await request(app.getHttpServer())
      .get(`/contributions/${workContribution}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(workContribution);
        expect(body).not.toHaveProperty('work');
      });
    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .get(`/contributions/${orgBContribution}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/contributions/${workContribution}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .get(`/contributions/c${'9'.repeat(24)}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  });

  it('updates and deletes by STAFF, immutably binds target and agent, and denies Reader before mutation', async () => {
    const [workContribution, editionContribution, orgBContribution] =
      await seed();
    await request(app.getHttpServer())
      .patch(`/contributions/${workContribution}`)
      .send({ roleLabel: 'translator', sortOrder: 2 })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          roleLabel: 'translator',
          sortOrder: 2,
          workId: workAId,
        }),
      );
    for (const field of [
      { workId: workBId },
      { editionId: editionBId },
      { agentId: agentBId },
      { organizationId: orgB },
    ]) {
      await request(app.getHttpServer())
        .patch(`/contributions/${workContribution}`)
        .send(field)
        .expect(400)
        .expect(({ body }) =>
          expect(body.code).toBe('VALIDATION_INVALID_BODY'),
        );
    }
    await request(app.getHttpServer())
      .patch(`/contributions/${workContribution}`)
      .set(header, orgB)
      .send({ roleLabel: 'x' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .patch(`/contributions/${orgBContribution}`)
      .send({ roleLabel: 'reader' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    await request(app.getHttpServer())
      .delete(`/contributions/${orgBContribution}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    await request(app.getHttpServer())
      .delete(`/contributions/${editionContribution}`)
      .expect(404);
    expect(rows).toHaveLength(3);

    currentUserId = 'user-a';
    await request(app.getHttpServer())
      .delete(`/contributions/${editionContribution}`)
      .expect(200);
    expect(rows.map((row) => row.id)).toEqual([
      workContribution,
      orgBContribution,
    ]);
    expect(agentMap.has(agentAId)).toBe(true);
  });

  it('rejects invalid agentId and invalid targets without creating records', async () => {
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, agentId: `c${'9'.repeat(24)}` })
      .expect(404);
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: `c${'9'.repeat(24)}`, agentId: agentAId })
      .expect(404);
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ editionId: `c${'9'.repeat(24)}`, agentId: agentAId })
      .expect(404);
    expect(rows).toEqual([]);
  });

  it('keeps legacy Contributor routes absent and returns the stable error envelope', async () => {
    await request(app.getHttpServer()).get('/contributors').expect(404);
    await request(app.getHttpServer())
      .post('/contributions')
      .send({ workId: workAId, agent: manualAgentDraft, organizationId: orgA })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_INVALID_BODY',
        });
        expect(body.message).toEqual(expect.any(String));
      });
  });
});
