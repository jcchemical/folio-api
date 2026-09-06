import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PorbaseImportService } from '../src/catalogues/porbase-import.service.js';
import { hashPassword } from '../src/auth/password.utils.js';

describe('PORBASE import confirmation (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const storedPasswordHash = await hashPassword('password');
    const prisma = {
      user: {
        findUnique: async () => ({
          id: 'e2e-user',
          email: 'e2e@example.com',
          name: 'E2E User',
          passwordHash: storedPasswordHash,
        }),
      },
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    };
    const importService = {
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
      .overrideProvider(PorbaseImportService)
      .useValue(importService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('logs in and confirms an authenticated import with HTTP 201', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@example.com', password: 'password' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/catalogues/porbase/import')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({})
      .expect(201)
      .expect(({ body }) => {
        if (body.work.title !== 'owned-by-e2e-user') {
          throw new Error('The import did not receive the JWT user id');
        }
      });
  });

  it('rejects confirmation without a token', async () => {
    await request(app.getHttpServer())
      .post('/catalogues/porbase/import')
      .send({})
      .expect(401);
  });
});
