import { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const organizationA = `c${'a'.repeat(24)}`;
const organizationB = `c${'b'.repeat(24)}`;
const recordAId = `c${'1'.repeat(24)}`;
const recordBId = `c${'2'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

describe('Bibliographic Record route (e2e)', () => {
  let app: INestApplication<App>;
  let currentUserId = 'user-a';

  beforeEach(async () => {
    currentUserId = 'user-a';
    const organizations = new Map([
      [organizationA, { id: organizationA, name: 'Organization A' }],
      [organizationB, { id: organizationB, name: 'Organization B' }],
    ]);
    const records = new Map([
      [
        recordAId,
        {
          id: recordAId,
          editionId: `c${'3'.repeat(24)}`,
          format: 'MARC_TEXT',
          rawContent: '200 $a Tenant A title',
          source: 'PORBASE',
          edition: {
            id: `c${'3'.repeat(24)}`,
            work: { id: `c${'4'.repeat(24)}`, organizationId: organizationA },
          },
        },
      ],
      [
        recordBId,
        {
          id: recordBId,
          editionId: `c${'5'.repeat(24)}`,
          format: 'MARC_TEXT',
          rawContent: '200 $a Tenant B title',
          source: 'PORBASE',
          edition: {
            id: `c${'5'.repeat(24)}`,
            work: { id: `c${'6'.repeat(24)}`, organizationId: organizationB },
          },
        },
      ],
    ]);
    const memberships = [
      { userId: 'user-a', organizationId: organizationA, role: 'OWNER' },
      { userId: 'user-a', organizationId: organizationB, role: 'STAFF' },
      { userId: 'user-b', organizationId: organizationB, role: 'READER' },
    ];

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
          const membership = memberships.find(
            (entry) =>
              entry.userId === key.userId &&
              entry.organizationId === key.organizationId,
          );
          return membership
            ? {
                ...membership,
                organization: organizations.get(key.organizationId),
              }
            : null;
        },
      },
      bibliographicRecord: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          records.get(where.id) ?? null,
      },
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

  it('derives the record organization through Edition → Work; matching header is optional', async () => {
    const withoutHeader = await request(app.getHttpServer())
      .get(`/bibliographic-records/${recordAId}`)
      .expect(200);
    expect(withoutHeader.body).toMatchObject({
      id: recordAId,
      edition: { work: { organizationId: organizationA } },
    });

    await request(app.getHttpServer())
      .get(`/bibliographic-records/${recordAId}`)
      .set(header, organizationA)
      .expect(200);
  });

  it('rejects a mismatching organization header with the stable conflict code', async () => {
    await request(app.getHttpServer())
      .get(`/bibliographic-records/${recordAId}`)
      .set(header, organizationB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
  });

  it('rejects a cross-organization read for a user without membership', async () => {
    currentUserId = 'user-b';

    await request(app.getHttpServer())
      .get(`/bibliographic-records/${recordAId}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('returns the stable not-found error for an unknown record', async () => {
    await request(app.getHttpServer())
      .get(`/bibliographic-records/${`c${'9'.repeat(24)}`}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  });
});
