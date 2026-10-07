import { INestApplication } from '@nestjs/common';
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
