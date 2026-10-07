import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PorbaseCatalogueProvider } from '../src/catalogues/porbase/porbase.provider.js';
import { hashPassword } from '../src/auth/password.utils.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { FOLIO_ORGANIZATION_HEADER } from '../src/organizations/organization-context.resolver.js';

const organizationA = `c${'a'.repeat(24)}`;
const organizationB = `c${'b'.repeat(24)}`;
const userA = {
  id: 'e2e-user-a',
  email: 'e2e-a@example.com',
  name: 'E2E User A',
  passwordHash: '',
  refreshToken: null as string | null,
  refreshTokenExpires: null as Date | null,
};
const userB = {
  id: 'e2e-user-b',
  email: 'e2e-b@example.com',
  name: 'E2E User B',
  passwordHash: '',
  refreshToken: null as string | null,
  refreshTokenExpires: null as Date | null,
};
const userReader = {
  id: 'e2e-user-reader',
  email: 'e2e-reader@example.com',
  name: 'E2E Reader',
  passwordHash: '',
  refreshToken: null as string | null,
  refreshTokenExpires: null as Date | null,
};

describe('Catalogue source operations (e2e)', () => {
  let app: INestApplication<App>;
  let importCalls: Array<{ userId: string; organizationId: string }>;
  let persistedWriteCount: number;

  beforeEach(async () => {
    const storedPasswordHash = await hashPassword('password');
    userA.passwordHash = storedPasswordHash;
    userB.passwordHash = storedPasswordHash;
    userReader.passwordHash = storedPasswordHash;
    importCalls = [];
    persistedWriteCount = 0;
    const users = [userA, userB, userReader];
    const prisma = {
      user: {
        findUnique: async ({
          where,
        }: {
          where: { email?: string; id?: string };
        }) =>
          users.find(
            (user) => user.email === where.email || user.id === where.id,
          ) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<(typeof users)[number]>;
        }) => {
          const user = users.find((entry) => entry.id === where.id);
          return user ? Object.assign(user, data) : null;
        },
      },
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === organizationA
            ? { id: organizationA, name: 'Organization A' }
            : where.id === organizationB
              ? { id: organizationB, name: 'Organization B' }
              : null,
      },
      organizationMembership: {
        findUnique: async ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const { userId, organizationId } = where.userId_organizationId;
          const role =
            userId === userA.id && organizationId === organizationA
              ? 'OWNER'
              : userId === userA.id && organizationId === organizationB
                ? 'STAFF'
                : userId === userB.id && organizationId === organizationB
                  ? 'ADMIN'
                  : userId === userReader.id && organizationId === organizationB
                    ? 'READER'
                    : null;
          return role ? { userId, organizationId, role } : null;
        },
      },
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    };
    const porbaseProvider = {
      id: 'porbase',
      name: 'PORBASE',
      format: 'UNIMARC',
      searchPreview: async () => ({
        sourceId: 'porbase',
        work: { title: 'E2E Preview' },
      }),
      import: async (
        userId: string,
        _input: unknown,
        organizationId: string,
      ) => {
        importCalls.push({ userId, organizationId });
        persistedWriteCount += 1;
        return {
          id: 'e2e-work',
          sourceId: 'porbase',
          work: {
            title: `owned-by-${userId}`,
            organization: { id: organizationId },
          },
          edition: { title: 'E2E Edition' },
          contributions: [],
          externalIdentifiers: [],
          bibliographicRecord: {
            format: 'MARCXCHANGE',
            schema: 'UNIMARC',
            source: 'PORBASE',
            rawContent: '<collection />',
          },
        };
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PorbaseCatalogueProvider)
      .useValue(porbaseProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const validImport = {
    work: { title: 'E2E Work' },
    edition: { title: 'E2E Edition' },
    externalIdentifiers: [],
    bibliographicRecord: {
      format: 'MARCXCHANGE',
      rawContent: '<collection />',
    },
  };

  it('uses PORBASE by default through the generic endpoints', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/search')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({ query: { type: 'isbn', isbn: '9789724426495' } })
      .expect(201)
      .expect(({ body }) => {
        expect(body.work.title).toBe('E2E Preview');
        expect(body.sourceId).toBe('porbase');
      });

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationA)
      .send(validImport)
      .expect(201)
      .expect(({ body }) => {
        expect(body.work.title).toBe(`owned-by-${userA.id}`);
        expect(body.work.organization.id).toBe(organizationA);
        expect(body.sourceId).toBe('porbase');
        expect(body).not.toHaveProperty('item');
        expect(body).not.toHaveProperty('contributors');
      });
    expect(importCalls).toEqual([
      { userId: userA.id, organizationId: organizationA },
    ]);

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationB)
      .send(validImport)
      .expect(201)
      .expect(({ body }) =>
        expect(body.work.organization.id).toBe(organizationB),
      );
    expect(importCalls).toEqual([
      { userId: userA.id, organizationId: organizationA },
      { userId: userA.id, organizationId: organizationB },
    ]);
  });

  it('rejects implicit, unknown, incomplete, and mismatched search queries', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);
    const token = login.body.accessToken as string;

    for (const body of [
      { query: { isbn: '9789724426495' } },
      { query: { type: 'identifier', isbn: '9789724426495' } },
      { query: { type: 'title' } },
      { query: { type: 'isbn', isbn: '9789724426495', title: 'Zorbás' } },
    ]) {
      await request(app.getHttpServer())
        .post('/catalogues/search')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400)
        .expect(({ body: responseBody }) =>
          expect(responseBody.code).toBe('VALIDATION_INVALID_BODY'),
        );
    }
  });

  it('uses an explicitly selected PORBASE source for a discriminated ISBN query', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/search')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({
        sourceId: 'porbase',
        query: { type: 'isbn', isbn: '9789724426495' },
      })
      .expect(201)
      .expect(({ body }) => expect(body.work.title).toBe('E2E Preview'));
  });

  it('returns the standard not-found error for an unknown search source', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/search')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({
        sourceId: 'missing-source',
        query: { type: 'isbn', isbn: '9789724426495' },
      })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  });

  it('returns the standard not-found error for an unknown import source', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationA)
      .send({ ...validImport, sourceId: 'missing-source' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  });

  it('keeps external search context-free and non-persistent', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/search')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({ query: { type: 'isbn', isbn: '9789724426495' } })
      .expect(201);
    expect(importCalls).toEqual([]);
    expect(persistedWriteCount).toBe(0);
  });

  it('rejects missing, malformed, nonexistent, and non-member organization contexts before provider persistence', async () => {
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);
    const tokenA = loginA.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .set(FOLIO_ORGANIZATION_HEADER, 'not-an-id')
      .send(validImport)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .set(FOLIO_ORGANIZATION_HEADER, `c${'z'.repeat(24)}`)
      .send(validImport)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_NOT_FOUND'));
    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userB.email, password: 'password' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${loginB.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationA)
      .send(validImport)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    expect(importCalls).toEqual([]);
    expect(persistedWriteCount).toBe(0);
  });

  it('allows selected member organizations according to role and rejects READER', async () => {
    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);
    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userB.email, password: 'password' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${loginA.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationB)
      .send(validImport)
      .expect(201)
      .expect(({ body }) =>
        expect(body.work.organization.id).toBe(organizationB),
      );
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${loginB.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationB)
      .send(validImport)
      .expect(201);

    const readerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userReader.email, password: 'password' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${readerLogin.body.accessToken as string}`)
      .set(FOLIO_ORGANIZATION_HEADER, organizationB)
      .send({ work: { organizationId: 'forged-reader-tenant' } })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    expect(importCalls).toEqual([
      { userId: userA.id, organizationId: organizationB },
      { userId: userB.id, organizationId: organizationB },
    ]);
    expect(persistedWriteCount).toBe(2);
  });

  it('rejects competing tenant and parent ownership fields before provider persistence', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);
    const token = login.body.accessToken as string;

    for (const payload of [
      { ...validImport, organizationId: organizationB },
      {
        ...validImport,
        work: { ...validImport.work, organizationId: organizationB },
      },
      {
        ...validImport,
        edition: { ...validImport.edition, workId: 'other-work' },
      },
    ]) {
      await request(app.getHttpServer())
        .post('/catalogues/import')
        .set('Authorization', `Bearer ${token}`)
        .set(FOLIO_ORGANIZATION_HEADER, organizationA)
        .send(payload)
        .expect(400)
        .expect(({ body }) =>
          expect(body.code).toBe('VALIDATION_INVALID_BODY'),
        );
    }
    expect(importCalls).toEqual([]);
    expect(persistedWriteCount).toBe(0);
  });

  it('rejects server-owned provenance fields instead of stripping them silently', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userA.email, password: 'password' })
      .expect(201);
    const token = login.body.accessToken as string;

    for (const payload of [
      {
        ...validImport,
        bibliographicRecord: {
          ...validImport.bibliographicRecord,
          source: 'FORGED_SOURCE',
        },
      },
      {
        ...validImport,
        bibliographicRecord: {
          ...validImport.bibliographicRecord,
          schema: 'FORGED_SCHEMA',
        },
      },
      {
        ...validImport,
        bibliographicRecord: {
          ...validImport.bibliographicRecord,
          sourceId: 'forged-provider',
        },
      },
    ]) {
      await request(app.getHttpServer())
        .post('/catalogues/import')
        .set('Authorization', `Bearer ${token}`)
        .set(FOLIO_ORGANIZATION_HEADER, organizationA)
        .send(payload)
        .expect(400)
        .expect(({ body }) =>
          expect(body.code).toBe('VALIDATION_INVALID_BODY'),
        );
    }
    expect(importCalls).toEqual([]);
    expect(persistedWriteCount).toBe(0);
  });

  it('rejects unauthenticated import confirmation while search retains its existing JWT contract', async () => {
    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set(FOLIO_ORGANIZATION_HEADER, organizationA)
      .send(validImport)
      .expect(401);
    await request(app.getHttpServer())
      .post('/catalogues/search')
      .send({ query: { type: 'isbn', isbn: '9789724426495' } })
      .expect(401);
  });
});
