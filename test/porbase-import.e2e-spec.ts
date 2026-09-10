import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PorbaseCatalogueProvider } from '../src/catalogues/porbase/porbase.provider.js';
import { hashPassword } from '../src/auth/password.utils.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';

describe('Catalogue source operations (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const storedPasswordHash = await hashPassword('password');
    const user = {
      id: 'e2e-user',
      email: 'e2e@example.com',
      name: 'E2E User',
      passwordHash: storedPasswordHash,
      refreshToken: null,
      refreshTokenExpires: null,
    };
    const prisma = {
      user: {
        findUnique: async () => user,
        update: async ({ data }: { data: Partial<typeof user> }) =>
          Object.assign(user, data),
      },
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    };
    const porbaseProvider = {
      id: 'porbase',
      name: 'PORBASE',
      format: 'UNIMARC',
      searchPreview: async () => ({ work: { title: 'E2E Preview' } }),
      import: async (userId: string) => ({
        id: 'e2e-work',
        work: { title: `owned-by-${userId}` },
        edition: { title: 'E2E Edition' },
        contributors: [],
        externalIdentifiers: [],
        bibliographicRecord: {
          format: 'MARCXCHANGE',
          schema: 'UNIMARC',
          source: 'PORBASE',
          rawContent: '<collection />',
        },
        item: { status: 'OWNED' },
      }),
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
    contributors: [],
    externalIdentifiers: [],
    bibliographicRecord: {
      format: 'MARCXCHANGE',
      schema: 'UNIMARC',
      source: 'PORBASE',
      rawContent: '<collection />',
    },
    item: { status: 'OWNED' },
  };

  it('uses PORBASE by default through the generic endpoints', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@example.com', password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/search')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({ query: { type: 'isbn', isbn: '9789724426495' } })
      .expect(201)
      .expect(({ body }) => expect(body.work.title).toBe('E2E Preview'));

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send(validImport)
      .expect(201)
      .expect(({ body }) => expect(body.work.title).toBe('owned-by-e2e-user'));
  });

  it('rejects implicit, unknown, incomplete, and mismatched search queries', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@example.com', password: 'password' })
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
      .send({ email: 'e2e@example.com', password: 'password' })
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
      .send({ email: 'e2e@example.com', password: 'password' })
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
      .send({ email: 'e2e@example.com', password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({ ...validImport, sourceId: 'missing-source' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  });
});
