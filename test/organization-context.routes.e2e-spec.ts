import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { AppModule } from '../src/app.module.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const organizationA = `c${'a'.repeat(24)}`;
const organizationB = `c${'b'.repeat(24)}`;
const workA = `c${'d'.repeat(24)}`;
const workB = `c${'e'.repeat(24)}`;
const editionA = `c${'f'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

const organizations = [
  { id: organizationA, name: 'Organization A' },
  { id: organizationB, name: 'Organization B' },
];
const memberships = [
  { userId: 'user-a', organizationId: organizationA, role: 'OWNER' },
  { userId: 'user-a', organizationId: organizationB, role: 'STAFF' },
  { userId: 'user-b', organizationId: organizationB, role: 'READER' },
];
const works = new Map<string, Record<string, unknown>>([
  [
    workA,
    {
      id: workA,
      title: 'Work A',
      organizationId: organizationA,
      editions: [],
      contributions: [],
    },
  ],
  [
    workB,
    {
      id: workB,
      title: 'Work B',
      organizationId: organizationB,
      editions: [],
      contributions: [],
    },
  ],
]);

function organization(id: string) {
  return organizations.find((entry) => entry.id === id) ?? null;
}

function membership(userId: string, organizationId: string) {
  const row = memberships.find(
    (entry) =>
      entry.userId === userId && entry.organizationId === organizationId,
  );
  return row ? { ...row, organization: organization(organizationId) } : null;
}

describe('Organization context routes (e2e)', () => {
  let app: INestApplication<App>;
  let currentUserId = 'user-a';
  let createdWorkOrganizationId: string | undefined;

  beforeEach(async () => {
    currentUserId = 'user-a';
    createdWorkOrganizationId = undefined;
    works.delete(`c${'1'.repeat(24)}`);
    works.set(workA, {
      id: workA,
      title: 'Work A',
      organizationId: organizationA,
      editions: [],
      contributions: [],
    });
    works.set(workB, {
      id: workB,
      title: 'Work B',
      organizationId: organizationB,
      editions: [],
      contributions: [],
    });
    const prisma: Record<string, any> = {
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          organization(where.id),
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
          return membership(key.userId, key.organizationId);
        },
        findMany: async ({ where }: { where: { userId: string } }) =>
          memberships
            .filter((entry) => entry.userId === where.userId)
            .map((entry) => ({
              ...entry,
              organization: organization(entry.organizationId),
            })),
      },
      work: {
        findMany: async ({ where }: { where: { organizationId: string } }) =>
          [...works.values()].filter(
            (work) => work.organizationId === where.organizationId,
          ),
        findUnique: async ({ where }: { where: { id: string } }) =>
          works.get(where.id) ?? null,
        create: async ({
          data,
        }: {
          data: { title: string; organizationId: string };
        }) => {
          createdWorkOrganizationId = data.organizationId;
          const created = {
            id: `c${'1'.repeat(24)}`,
            ...data,
            editions: [],
            contributions: [],
          };
          works.set(created.id, created);
          return created;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const existing = works.get(where.id)!;
          const updated = { ...existing, ...data };
          works.set(where.id, updated);
          return updated;
        },
        delete: async ({ where }: { where: { id: string } }) =>
          works.get(where.id),
      },
      edition: {
        findMany: async () => [],
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === editionA
            ? {
                id: editionA,
                work: {
                  id: workA,
                  organizationId: organizationA,
                  contributions: [],
                  titles: [],
                },
                contributions: [],
                titles: [],
                editionCovers: [],
              }
            : null,
        findUniqueOrThrow: async () => ({
          id: editionA,
          editionCovers: [],
          physicalDescriptions: [],
          publicationStatements: [],
        }),
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: editionA,
          ...data,
          editionCovers: [],
          physicalDescriptions: [],
        }),
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => ({ id: where.id, ...data }),
        delete: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
        }),
      },
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback({
          work: {
            create: (args: {
              data: { title: string; organizationId: string };
            }) => prisma.work.create(args),
          },
          edition: {
            create: (args: { data: Record<string, unknown> }) =>
              prisma.edition.create(args),
            update: (args: {
              where: { id: string };
              data: Record<string, unknown>;
            }) => prisma.edition.update(args),
            findUniqueOrThrow: () => prisma.edition.findUniqueOrThrow(),
          },
        }),
      externalIdentifier: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (callback: (client: unknown) => unknown) =>
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
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 20_000);

  afterEach(async () => {
    await app.close();
  });

  it('lists caller memberships without a context header and scopes organization resources by path', async () => {
    await request(app.getHttpServer())
      .get('/organizations')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(2));

    await request(app.getHttpServer())
      .get(`/organizations/${organizationA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/organizations/${organizationA}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          code: 'ORGANIZATION_CONTEXT_CONFLICT',
          statusCode: 409,
        }),
      );

    await request(app.getHttpServer())
      .put(`/organizations/${organizationA}`)
      .set(header, organizationB)
      .send({ name: 'Must not rename' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .delete(`/organizations/${organizationA}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .get('/organizations')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(organizationB);
      });
    await request(app.getHttpServer())
      .get(`/organizations/${organizationA}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('requires explicit Work list/create context and lists only the selected organization', async () => {
    await request(app.getHttpServer())
      .get('/works')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );

    await request(app.getHttpServer())
      .get('/works')
      .set(header, 'not-a-cuid')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));

    await request(app.getHttpServer())
      .get('/works')
      .set(header, `c${'z'.repeat(24)}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_NOT_FOUND'));

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .get('/works')
      .set(header, organizationA)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    currentUserId = 'user-a';

    await request(app.getHttpServer())
      .get('/works')
      .set(header, organizationA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((work: { id: string }) => work.id)).toEqual([
          workA,
        ]),
      );

    await request(app.getHttpServer())
      .post('/works')
      .send({ title: 'No context', organizationId: organizationA })
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );

    await request(app.getHttpServer())
      .post('/works')
      .set(header, organizationB)
      .send({ title: 'Created in B', organizationId: organizationA })
      .expect(201);
    expect(createdWorkOrganizationId).toBe(organizationB);
  });

  it('derives Work resource context from the persisted Work before reading or writing', async () => {
    await request(app.getHttpServer())
      .get(`/works/${workA}`)
      .set(header, organizationA)
      .expect(200);

    await request(app.getHttpServer())
      .put(`/works/${workA}`)
      .set(header, organizationB)
      .send({ title: 'Must not update' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .delete(`/works/${workA}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/works/${workA}`)
      .set(header, organizationA)
      .send({ title: 'Updated A' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/works/${workA}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .delete(`/works/${workA}`)
      .set(header, organizationA)
      .expect(200);

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .get(`/works/${workA}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('requires context for Edition root lists and derives Edition create tenancy from workId', async () => {
    await request(app.getHttpServer())
      .get('/editions')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );

    await request(app.getHttpServer())
      .get('/editions')
      .set(header, organizationA)
      .expect(200);

    await request(app.getHttpServer())
      .post('/editions')
      .send({ title: 'Edition for A', workId: workA })
      .expect(201);

    await request(app.getHttpServer())
      .post('/editions')
      .set(header, organizationA)
      .send({ title: 'Edition for A with matching header', workId: workA })
      .expect(201);

    await request(app.getHttpServer())
      .post('/editions')
      .set(header, organizationB)
      .send({ title: 'Conflicting edition', workId: workA })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .post('/editions')
      .send({ title: 'No membership in A', workId: workA })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('derives Edition resource context through Work for GET, PUT, and DELETE', async () => {
    await request(app.getHttpServer())
      .get(`/editions/${editionA}`)
      .set(header, organizationA)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/editions/${editionA}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .put(`/editions/${editionA}`)
      .set(header, organizationA)
      .send({ title: 'Updated edition' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/editions/${editionA}`)
      .set(header, organizationB)
      .send({ title: 'Must not update' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .delete(`/editions/${editionA}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .delete(`/editions/${editionA}`)
      .set(header, organizationA)
      .expect(200);

    currentUserId = 'user-b';
    await request(app.getHttpServer())
      .get(`/editions/${editionA}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });
});
