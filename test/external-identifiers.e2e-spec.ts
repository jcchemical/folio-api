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
const editionA = `c${'1'.repeat(24)}`;
const editionB = `c${'2'.repeat(24)}`;
const identifierAId = `c${'3'.repeat(24)}`;
const identifierBId = `c${'4'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

type WorkRow = { id: string; organizationId: string };
type EditionRow = { id: string; workId: string; work: WorkRow };
type IdentifierRow = {
  id: string;
  type: string;
  value: string;
  source: string | null;
  editionId: string;
  edition: EditionRow;
};

function makeState() {
  const works = new Map<string, WorkRow>([
    ['work-a', { id: 'work-a', organizationId: orgA }],
    ['work-b', { id: 'work-b', organizationId: orgB }],
  ]);
  const editions = new Map<string, EditionRow>([
    [editionA, { id: editionA, workId: 'work-a', work: works.get('work-a')! }],
    [editionB, { id: editionB, workId: 'work-b', work: works.get('work-b')! }],
  ]);
  const identifiers = new Map<string, IdentifierRow>([
    [
      identifierAId,
      {
        id: identifierAId,
        type: 'ISBN-13',
        value: '9780000000001',
        source: 'A',
        editionId: editionA,
        edition: editions.get(editionA)!,
      },
    ],
    [
      identifierBId,
      {
        id: identifierBId,
        type: 'ISBN-13',
        value: '9780000000002',
        source: 'B',
        editionId: editionB,
        edition: editions.get(editionB)!,
      },
    ],
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
  let sequence = 0;

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
        const row = memberships.find(
          (membership) =>
            membership.userId === key.userId &&
            membership.organizationId === key.organizationId,
        );
        return row
          ? { ...row, organization: organizations.get(key.organizationId) }
          : null;
      },
    },
    edition: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        editions.get(where.id) ?? null,
    },
    externalIdentifier: {
      findMany: async ({
        where,
      }: {
        where: {
          edition: { work: { organizationId: string } };
          editionId?: string;
        };
      }) =>
        [...identifiers.values()].filter(
          (row) =>
            row.edition.work.organizationId ===
              where.edition.work.organizationId &&
            (!where.editionId || row.editionId === where.editionId),
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        identifiers.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: {
          type: string;
          value: string;
          source?: string | null;
          editionId: string;
        };
      }) => {
        sequence += 1;
        const row: IdentifierRow = {
          id: `c${sequence.toString().padStart(24, '0')}`,
          ...data,
          source: data.source ?? null,
          edition: editions.get(data.editionId)!,
        };
        identifiers.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<IdentifierRow>;
      }) => Object.assign(identifiers.get(where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => {
        const row = identifiers.get(where.id)!;
        identifiers.delete(where.id);
        return row;
      },
    },
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };
  return { prisma, identifiers };
}

describe('External Identifiers organization context (e2e)', () => {
  let app: INestApplication<App>;
  let userId = 'user-a';
  let state: ReturnType<typeof makeState>;

  beforeEach(async () => {
    userId = 'user-a';
    state = makeState();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(state.prisma)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { id: userId };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 20_000);

  afterEach(async () => app.close());

  it('requires and validates root context, never returns a multi-membership union, and refines editionId within the tenant', async () => {
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, 'invalid')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, `c${'z'.repeat(24)}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_NOT_FOUND'));

    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((item: IdentifierRow) => item.id)).toEqual([
          identifierAId,
        ]);
      });
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgB)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((item: IdentifierRow) => item.id)).toEqual([
          identifierBId,
        ]);
      });
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgB)
      .query({ editionId: editionA })
      .expect(200)
      .expect(({ body }) => expect(body.items).toEqual([]));
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .query({ organizationId: orgA })
      .set(header, orgA)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));

    userId = 'user-b';
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgA)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('creates under Edition-derived ownership without a header and enforces optional consistency and write roles', async () => {
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .send({ type: 'OCLC', value: '123', editionId: editionA })
      .expect(201);
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgA)
      .send({ type: 'OCLC', value: '124', editionId: editionA })
      .expect(201);

    const before = state.identifiers.size;
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgB)
      .send({ type: 'OCLC', value: '125', editionId: editionA })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgA)
      .send({
        type: 'OCLC',
        value: '126',
        editionId: editionA,
        organizationId: orgB,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .send({
        type: 'OCLC',
        value: '127',
        editionId: editionA,
        workId: 'work-a',
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    expect(state.identifiers.size).toBe(before);

    userId = 'user-b';
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .send({ type: 'OCLC', value: '128', editionId: editionA })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .send({ type: 'OCLC', value: '129', editionId: editionB })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
  });

  it('derives detail, update, and delete from the persisted identifier and rejects cross-tenant access before mutation', async () => {
    await request(app.getHttpServer())
      .get(`/external-identifiers/${identifierAId}`)
      .set(header, orgA)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/external-identifiers/${identifierAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/external-identifiers/${identifierAId}`)
      .set(header, orgB)
      .send({ value: 'must-not-update' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/external-identifiers/${identifierAId}`)
      .set(header, orgA)
      .send({ editionId: editionB })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .put(`/external-identifiers/${identifierAId}`)
      .set(header, orgA)
      .send({ value: 'updated-value' })
      .expect(200)
      .expect(({ body }) => expect(body.value).toBe('updated-value'));

    userId = 'user-b';
    await request(app.getHttpServer())
      .get(`/external-identifiers/${identifierAId}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    await request(app.getHttpServer())
      .delete(`/external-identifiers/${identifierBId}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    expect(state.identifiers.has(identifierBId)).toBe(true);

    userId = 'user-a';
    await request(app.getHttpServer())
      .delete(`/external-identifiers/${identifierAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .delete(`/external-identifiers/${identifierAId}`)
      .set(header, orgA)
      .expect(200);
    expect(state.identifiers.has(identifierAId)).toBe(false);
  });

  it('uses the stable error envelope for organization-context failures', async () => {
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          code: 'ORGANIZATION_CONTEXT_REQUIRED',
        });
        expect(body.message).toEqual(expect.any(String));
      });
  });
});
