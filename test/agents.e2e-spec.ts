import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Prisma } from '../src/generated/prisma/client.js';
import { AppModule } from '../src/app.module.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const orgA = `c${'a'.repeat(24)}`;
const orgB = `c${'b'.repeat(24)}`;
const agentAId = `c${'5'.repeat(24)}`;
const agentBId = `c${'6'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

type Agent = {
  id: string;
  organizationId: string;
  kind: string;
  displayName: string;
  normalizedDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('Agents (e2e)', () => {
  let app: INestApplication<App>;
  let currentUserId = 'user-a';
  let agents: Map<string, Agent>;
  let withContributions: Set<string>;

  const makeAgent = (
    id: string,
    organizationId: string,
    displayName: string,
    day: number,
  ): Agent => ({
    id,
    organizationId,
    kind: 'PERSON',
    displayName,
    normalizedDisplayName: displayName.toLowerCase(),
    createdAt: new Date(2026, 0, day),
    updatedAt: new Date(2026, 0, day),
  });

  beforeEach(async () => {
    currentUserId = 'user-a';
    withContributions = new Set();
    agents = new Map([
      [agentAId, makeAgent(agentAId, orgA, 'Agent A', 1)],
      [agentBId, makeAgent(agentBId, orgB, 'Agent B', 2)],
    ]);
    const organizations = new Map([
      [orgA, { id: orgA, name: 'Organization A' }],
      [orgB, { id: orgB, name: 'Organization B' }],
    ]);
    const memberships = [
      { userId: 'user-a', organizationId: orgA, role: 'OWNER' },
      { userId: 'user-a', organizationId: orgB, role: 'STAFF' },
      { userId: 'user-b', organizationId: orgB, role: 'READER' },
    ];
    let generated = 0;
    const matches = (agent: Agent, where: Record<string, unknown>) =>
      Object.entries(where).every(([key, value]) => {
        if (key === 'id' && typeof value === 'object') {
          return agent.id !== (value as { not: string }).not;
        }
        return (agent as Record<string, unknown>)[key] === value;
      });

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
          return (
            memberships.find(
              (row) =>
                row.userId === key.userId &&
                row.organizationId === key.organizationId,
            ) ?? null
          );
        },
      },
      agent: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          agents.get(where.id) ?? null,
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          [...agents.values()].find((agent) => matches(agent, where)) ?? null,
        findMany: async ({
          where,
          take,
          cursor,
          skip,
        }: {
          where: Record<string, unknown>;
          take: number;
          cursor?: { id: string };
          skip?: number;
        }) => {
          let found = [...agents.values()]
            .filter((agent) => matches(agent, where))
            .sort((a, b) =>
              a.normalizedDisplayName.localeCompare(b.normalizedDisplayName),
            );
          if (cursor) {
            const index = found.findIndex((agent) => agent.id === cursor.id);
            found = index < 0 ? [] : found.slice(index + (skip ?? 0));
          }
          return found.slice(0, take);
        },
        create: async ({ data }: { data: Omit<Agent, 'id'> }) => {
          generated += 1;
          const agent = {
            id: `c${generated.toString().padStart(24, '0')}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          agents.set(agent.id, agent);
          return agent;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Agent>;
        }) => {
          const agent = Object.assign(agents.get(where.id)!, data);
          return agent;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          if (withContributions.has(where.id)) {
            throw new Prisma.PrismaClientKnownRequestError('fk', {
              code: 'P2003',
              clientVersion: 'test',
            });
          }
          const agent = agents.get(where.id)!;
          agents.delete(where.id);
          return agent;
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
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 20_000);

  afterEach(async () => app.close());

  it('requires explicit Organization context for root list and create', async () => {
    await request(app.getHttpServer())
      .get('/agents')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .post('/agents')
      .send({ displayName: 'X', kind: 'PERSON' })
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/agents')
      .set(header, 'not-an-id')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
  });

  it('lists only the caller Organization with filters and cursor pagination', async () => {
    await request(app.getHttpServer())
      .post('/agents')
      .set(header, orgA)
      .send({ displayName: 'Zed', kind: 'CORPORATE_BODY' })
      .expect(201);
    const first = await request(app.getHttpServer())
      .get('/agents')
      .set(header, orgA)
      .query({ limit: 1 })
      .expect(200);
    expect(first.body.items.map((a: Agent) => a.id)).toEqual([agentAId]);
    expect(first.body.hasMore).toBe(true);
    const second = await request(app.getHttpServer())
      .get('/agents')
      .set(header, orgA)
      .query({ limit: 1, cursor: first.body.nextCursor })
      .expect(200);
    expect(second.body.items[0].displayName).toBe('Zed');
    await request(app.getHttpServer())
      .get('/agents')
      .set(header, orgA)
      .query({ kind: 'CORPORATE_BODY' })
      .expect(200)
      .expect(({ body }) => expect(body.items).toHaveLength(1));
    await request(app.getHttpServer())
      .get('/agents')
      .set(header, orgB)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((a: Agent) => a.id)).toEqual([agentBId]),
      );
    await request(app.getHttpServer())
      .get('/agents')
      .set(header, orgA)
      .query({ organizationId: orgB })
      .expect(400);
  });

  it('creates in the header Organization, rejects body organizationId and duplicates', async () => {
    await request(app.getHttpServer())
      .post('/agents')
      .set(header, orgA)
      .send({ displayName: ' New Agent ', kind: 'PERSON' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.organizationId).toBe(orgA);
        expect(body.displayName).toBe('New Agent');
      });
    await request(app.getHttpServer())
      .post('/agents')
      .set(header, orgA)
      .send({ displayName: 'new agent', kind: 'PERSON' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CONFLICT_DUPLICATE_RESOURCE'),
      );
    await request(app.getHttpServer())
      .post('/agents')
      .set(header, orgA)
      .send({ displayName: 'Q', kind: 'PERSON', organizationId: orgB })
      .expect(400);
    await request(app.getHttpServer())
      .post('/agents')
      .set(header, orgA)
      .send({ displayName: '   ', kind: 'PERSON' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/agents')
      .set(header, orgA)
      .send({ displayName: 'Q', kind: 'ROBOT' })
      .expect(400);
  });

  it('fetches by id for members and masks non-members as RESOURCE_NOT_FOUND', async () => {
    await request(app.getHttpServer())
      .get(`/agents/${agentAId}`)
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(agentAId));
    currentUserId = 'user-b';
    await request(app.getHttpServer()).get(`/agents/${agentBId}`).expect(200);
    await request(app.getHttpServer())
      .get(`/agents/${agentAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    currentUserId = 'user-a';
    await request(app.getHttpServer())
      .get(`/agents/${agentAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
  });

  it('updates and deletes as STAFF and denies Reader writes', async () => {
    await request(app.getHttpServer())
      .patch(`/agents/${agentAId}`)
      .send({ displayName: 'Renamed' })
      .expect(200)
      .expect(({ body }) => expect(body.displayName).toBe('Renamed'));
    await request(app.getHttpServer())
      .patch(`/agents/${agentAId}`)
      .send({ organizationId: orgB })
      .expect(400);

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .patch(`/agents/${agentBId}`)
      .send({ displayName: 'Nope' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    await request(app.getHttpServer())
      .delete(`/agents/${agentBId}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/agents/${agentAId}`)
      .expect(404);
    expect(agents.size).toBe(2);

    currentUserId = 'user-a';
    await request(app.getHttpServer())
      .delete(`/agents/${agentAId}`)
      .expect(200);
    expect(agents.has(agentAId)).toBe(false);
    expect(agents.has(agentBId)).toBe(true);
  });

  it('refuses to delete an Agent that still has Contributions', async () => {
    withContributions.add(agentAId);
    await request(app.getHttpServer())
      .delete(`/agents/${agentAId}`)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CONFLICT_FOREIGN_KEY_REFERENCE'),
      );
    expect(agents.has(agentAId)).toBe(true);
  });
});
