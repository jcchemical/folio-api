import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const orgA = `c${'a'.repeat(24)}`;
const orgB = `c${'b'.repeat(24)}`;
const workA = `c${'1'.repeat(24)}`;
const workB = `c${'2'.repeat(24)}`;
const editionA = `c${'3'.repeat(24)}`;
const libraryA = `c${'4'.repeat(24)}`;
const locationA = `c${'5'.repeat(24)}`;
const holdingA = `c${'6'.repeat(24)}`;
const itemA = `c${'7'.repeat(24)}`;
const workIdentifierA = `c${'8'.repeat(24)}`;
const editionIdentifierA = `c${'9'.repeat(24)}`;
const libraryIdentifierA = `c${'0'.repeat(24)}`;
const workIdentifierB = `c${'d'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

type OrganizationRecord = { id: string; name: string };
type EntityRecord = {
  entityType: string;
  id: string;
  organizationId: string;
  relatedOrganizationId?: string;
};
type IdentifierRecord = {
  id: string;
  entityType: string;
  entityId: string;
  authority: string;
  value: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeState() {
  const organizations = new Map<string, OrganizationRecord>([
    [orgA, { id: orgA, name: 'Organization A' }],
    [orgB, { id: orgB, name: 'Organization B' }],
  ]);
  const entities = new Map<string, EntityRecord>();
  for (const [type, id, organizationId] of [
    ['Work', workA, orgA],
    ['Work', workB, orgB],
    ['Edition', editionA, orgA],
    ['Library', libraryA, orgA],
    ['Location', locationA, orgA],
    ['Holding', holdingA, orgA],
    ['Item', itemA, orgA],
  ]) {
    entities.set(`${type}:${id}`, { entityType: type, id, organizationId });
  }
  const identifiers = new Map<string, IdentifierRecord>([
    [
      workIdentifierA,
      makeIdentifier(workIdentifierA, 'Work', workA, orgA, 'a', 1),
    ],
    [
      editionIdentifierA,
      makeIdentifier(editionIdentifierA, 'Edition', editionA, orgA, 'b', 2),
    ],
    [
      libraryIdentifierA,
      makeIdentifier(libraryIdentifierA, 'Library', libraryA, orgA, 'c', 3),
    ],
    [
      workIdentifierB,
      makeIdentifier(workIdentifierB, 'Work', workB, orgB, 'd', 1),
    ],
  ]);
  const memberships = [
    { userId: 'user-a', organizationId: orgA, role: 'STAFF' },
    { userId: 'user-a', organizationId: orgB, role: 'STAFF' },
    { userId: 'user-b', organizationId: orgB, role: 'READER' },
  ];
  let sequence = 10;

  function entityOrganization(entityType: string, entityId: string) {
    const entity = entities.get(`${entityType}:${entityId}`);
    if (!entity) return null;
    if (entityType === 'Edition') {
      return { work: { organizationId: entity.organizationId } };
    }
    if (entityType === 'Location') {
      return { library: { organizationId: entity.organizationId } };
    }
    if (entityType === 'Holding') {
      return {
        edition: { work: { organizationId: entity.organizationId } },
        location: {
          library: {
            organizationId:
              entity.relatedOrganizationId ?? entity.organizationId,
          },
        },
      };
    }
    if (entityType === 'Item') {
      return {
        holding: {
          edition: { work: { organizationId: entity.organizationId } },
          location: {
            library: {
              organizationId:
                entity.relatedOrganizationId ?? entity.organizationId,
            },
          },
        },
      };
    }
    return { organizationId: entity.organizationId };
  }

  const entityModels = {
    work: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        entityOrganization('Work', where.id),
    },
    edition: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        entityOrganization('Edition', where.id),
    },
    library: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        entityOrganization('Library', where.id),
    },
    location: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        entityOrganization('Location', where.id),
    },
    holding: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        entityOrganization('Holding', where.id),
    },
    item: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        entityOrganization('Item', where.id),
    },
  };
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
    ...entityModels,
    externalIdentifier: {
      findMany: async ({
        where,
        take,
        cursor,
        skip,
      }: {
        where: {
          organizationId: string;
          entityType?: string;
          entityId?: string;
          authority?: string;
        };
        take: number;
        cursor?: { id: string };
        skip?: number;
      }) => {
        let rows = [...identifiers.values()].filter(
          (row) =>
            row.organizationId === where.organizationId &&
            (!where.entityType || row.entityType === where.entityType) &&
            (!where.entityId || row.entityId === where.entityId) &&
            (!where.authority || row.authority === where.authority),
        );
        rows.sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime() ||
            right.id.localeCompare(left.id),
        );
        if (cursor) {
          const index = rows.findIndex((row) => row.id === cursor.id);
          rows = index < 0 ? [] : rows.slice(index + (skip ?? 0));
        }
        return rows.slice(0, take);
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        identifiers.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: Omit<IdentifierRecord, 'id' | 'createdAt' | 'updatedAt'>;
      }) => {
        if (
          [...identifiers.values()].some(
            (row) =>
              row.entityType === data.entityType &&
              row.entityId === data.entityId &&
              row.authority === data.authority &&
              row.value === data.value,
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        sequence += 1;
        const now = new Date();
        const row: IdentifierRecord = {
          id: `c${sequence.toString().padStart(24, '0')}`,
          ...data,
          createdAt: now,
          updatedAt: now,
        };
        identifiers.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Pick<IdentifierRecord, 'authority' | 'value'>>;
      }) => {
        const row = identifiers.get(where.id)!;
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = identifiers.get(where.id)!;
        identifiers.delete(where.id);
        return row;
      },
    },
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };
  return { prisma, identifiers, entities };
}

function makeIdentifier(
  id: string,
  entityType: string,
  entityId: string,
  organizationId: string,
  valueSuffix: string,
  day: number,
): IdentifierRecord {
  const timestamp = new Date(`2026-01-0${day}T00:00:00Z`);
  return {
    id,
    entityType,
    entityId,
    authority: 'oclc',
    value: `value-${valueSuffix}`,
    organizationId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  }, 20_000);

  afterEach(async () => app.close());

  it('requires root context and limits filtered, paginated lists to one Organization', async () => {
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
      .query({ limit: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((row: IdentifierRecord) => row.id)).toEqual([
          libraryIdentifierA,
        ]);
        expect(body.hasMore).toBe(true);
        expect(body.nextCursor).toBe(libraryIdentifierA);
      });
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgA)
      .query({ cursor: libraryIdentifierA, limit: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.items.map((row: IdentifierRecord) => row.id)).toEqual([
          editionIdentifierA,
        ]);
      });
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgA)
      .query({ entityType: 'Edition', entityId: editionA, authority: 'oclc' })
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: IdentifierRecord) => row.id)).toEqual([
          editionIdentifierA,
        ]),
      );
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgB)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: IdentifierRecord) => row.id)).toEqual([
          workIdentifierB,
        ]),
      );
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgA)
      .query({ organizationId: orgB })
      .expect(400);

    userId = 'user-b';
    await request(app.getHttpServer())
      .get('/external-identifiers')
      .set(header, orgA)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('creates identifiers for all entity types with server-derived Organization ownership', async () => {
    const types = [
      ['Work', workA],
      ['Edition', editionA],
      ['Library', libraryA],
      ['Location', locationA],
      ['Holding', holdingA],
      ['Item', itemA],
    ] as const;

    for (const [entityType, entityId] of types) {
      await request(app.getHttpServer())
        .post('/external-identifiers')
        .set(header, orgA)
        .send({
          entityType,
          entityId,
          authority: 'local',
          value: `local-${entityType}`,
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            entityType,
            entityId,
            authority: 'local',
            organizationId: orgA,
          });
        });
    }
    expect(state.identifiers.size).toBe(10);
  });

  it('masks non-member reads, enforces write roles, and mutates only after authorization', async () => {
    const initialBValue = state.identifiers.get(workIdentifierB)?.value;

    userId = 'user-b';
    await request(app.getHttpServer())
      .get(`/external-identifiers/${workIdentifierB}`)
      .set(header, orgB)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/external-identifiers/${workIdentifierB}`)
      .set(header, orgB)
      .send({ value: 'reader-cannot-change' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    await request(app.getHttpServer())
      .delete(`/external-identifiers/${workIdentifierB}`)
      .set(header, orgB)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    await request(app.getHttpServer())
      .get(`/external-identifiers/${workIdentifierA}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    expect(state.identifiers.get(workIdentifierB)?.value).toBe(initialBValue);
    expect(state.identifiers.has(workIdentifierB)).toBe(true);

    userId = 'user-a';
    await request(app.getHttpServer())
      .put(`/external-identifiers/${workIdentifierA}`)
      .set(header, orgA)
      .send({ value: 'updated-by-staff' })
      .expect(200)
      .expect(({ body }) => expect(body.value).toBe('updated-by-staff'));
    await request(app.getHttpServer())
      .delete(`/external-identifiers/${workIdentifierA}`)
      .set(header, orgA)
      .expect(200);
    expect(state.identifiers.has(workIdentifierA)).toBe(false);
  });

  it('rejects cross-Organization bindings and duplicate pairs without mutation', async () => {
    userId = 'user-b';
    const before = state.identifiers.size;
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgB)
      .send({
        entityType: 'Work',
        entityId: workA,
        authority: 'local',
        value: 'cross-org',
      })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    expect(state.identifiers.size).toBe(before);

    userId = 'user-a';
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgA)
      .send({
        entityType: 'Work',
        entityId: workA,
        authority: 'oclc',
        value: 'value-a',
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CONFLICT_DUPLICATE_EXTERNAL_IDENTIFIER'),
      );
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgB)
      .send({
        entityType: 'Work',
        entityId: workA,
        authority: 'local',
        value: 'mismatched-header',
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    expect(state.identifiers.size).toBe(before);
  });

  it('rejects tenant body fields and safely rejects inconsistent Holding ownership', async () => {
    userId = 'user-a';
    const before = state.identifiers.size;
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .send({
        entityType: 'Work',
        entityId: workA,
        authority: 'local',
        value: 'forged',
        organizationId: orgB,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    state.entities.set(`Holding:${holdingA}`, {
      entityType: 'Holding',
      id: holdingA,
      organizationId: orgA,
      relatedOrganizationId: orgB,
    });
    await request(app.getHttpServer())
      .post('/external-identifiers')
      .set(header, orgA)
      .send({
        entityType: 'Holding',
        entityId: holdingA,
        authority: 'local',
        value: 'invalid-parent-pair',
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    expect(state.identifiers.size).toBe(before);
  });
});
