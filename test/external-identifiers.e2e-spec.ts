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
const editionB = `c${'e'.repeat(24)}`;
const libraryA = `c${'4'.repeat(24)}`;
const libraryB = `c${'f'.repeat(24)}`;
const locationA = `c${'5'.repeat(24)}`;
const locationB = `c${'g'.repeat(24)}`;
const holdingA = `c${'6'.repeat(24)}`;
const holdingB = `c${'h'.repeat(24)}`;
const itemA = `c${'7'.repeat(24)}`;
const itemB = `c${'i'.repeat(24)}`;
const cascadeWork = `c${'p'.repeat(24)}`;
const cascadeEdition = `c${'q'.repeat(24)}`;
const cascadeHolding = `c${'r'.repeat(24)}`;
const cascadeItem = `c${'s'.repeat(24)}`;
const cascadeLibrary = `c${'t'.repeat(24)}`;
const cascadeLocation = `c${'u'.repeat(24)}`;
const cascadeHoldingLocation = `c${'y'.repeat(24)}`;
const restrictedLibrary = `c${'z'.repeat(24)}`;
const restrictedLocation = `c${'v'.repeat(24)}`;
const restrictedHolding = `c${'w'.repeat(24)}`;
const restrictedItem = `c${'x'.repeat(24)}`;
const restrictedLibraryIdentifier = `c${'z'.repeat(23)}0`;
const cascadeWorkIdentifier = `c${'p'.repeat(23)}q`;
const cascadeEditionIdentifier = `c${'q'.repeat(23)}r`;
const cascadeHoldingIdentifier = `c${'r'.repeat(23)}s`;
const cascadeItemIdentifier = `c${'s'.repeat(23)}t`;
const cascadeLibraryIdentifier = `c${'t'.repeat(23)}u`;
const cascadeLocationIdentifier = `c${'u'.repeat(23)}v`;
const restrictedLocationIdentifier = `c${'v'.repeat(23)}w`;
const restrictedHoldingIdentifier = `c${'w'.repeat(23)}x`;
const restrictedItemIdentifier = `c${'x'.repeat(23)}y`;
const workIdentifierA = `c${'8'.repeat(24)}`;
const editionIdentifierA = `c${'9'.repeat(24)}`;
const libraryIdentifierA = `c${'0'.repeat(24)}`;
const workIdentifierB = `c${'d'.repeat(24)}`;
const editionIdentifierB = `c${'j'.repeat(24)}`;
const libraryIdentifierB = `c${'k'.repeat(24)}`;
const locationIdentifierB = `c${'l'.repeat(24)}`;
const holdingIdentifierB = `c${'m'.repeat(24)}`;
const itemIdentifierB = `c${'n'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

type OrganizationRecord = { id: string; name: string };
type EntityRecord = {
  entityType: string;
  id: string;
  organizationId: string;
  relatedOrganizationId?: string;
  workId?: string;
  editionId?: string;
  holdingId?: string;
  libraryId?: string;
  locationId?: string;
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
    ['Edition', editionB, orgB],
    ['Library', libraryA, orgA],
    ['Library', libraryB, orgB],
    ['Location', locationA, orgA],
    ['Location', locationB, orgB],
    ['Holding', holdingA, orgA],
    ['Holding', holdingB, orgB],
    ['Item', itemA, orgA],
    ['Item', itemB, orgB],
  ]) {
    entities.set(`${type}:${id}`, { entityType: type, id, organizationId });
  }
  const cascadeEntities: EntityRecord[] = [
    { entityType: 'Work', id: cascadeWork, organizationId: orgA },
    {
      entityType: 'Edition',
      id: cascadeEdition,
      organizationId: orgA,
      workId: cascadeWork,
    },
    {
      entityType: 'Holding',
      id: cascadeHolding,
      organizationId: orgA,
      editionId: cascadeEdition,
      locationId: cascadeHoldingLocation,
    },
    {
      entityType: 'Item',
      id: cascadeItem,
      organizationId: orgA,
      holdingId: cascadeHolding,
    },
    { entityType: 'Library', id: cascadeLibrary, organizationId: orgA },
    {
      entityType: 'Location',
      id: cascadeLocation,
      organizationId: orgA,
      libraryId: cascadeLibrary,
    },
    {
      entityType: 'Location',
      id: cascadeHoldingLocation,
      organizationId: orgA,
    },
    { entityType: 'Library', id: restrictedLibrary, organizationId: orgA },
    {
      entityType: 'Location',
      id: restrictedLocation,
      organizationId: orgA,
      libraryId: restrictedLibrary,
    },
    {
      entityType: 'Holding',
      id: restrictedHolding,
      organizationId: orgA,
      editionId: editionA,
      locationId: restrictedLocation,
    },
    {
      entityType: 'Item',
      id: restrictedItem,
      organizationId: orgA,
      holdingId: restrictedHolding,
    },
  ];
  for (const entity of cascadeEntities) {
    entities.set(`${entity.entityType}:${entity.id}`, entity);
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
    [
      editionIdentifierB,
      makeIdentifier(editionIdentifierB, 'Edition', editionB, orgB, 'e', 2),
    ],
    [
      libraryIdentifierB,
      makeIdentifier(libraryIdentifierB, 'Library', libraryB, orgB, 'f', 3),
    ],
    [
      locationIdentifierB,
      makeIdentifier(locationIdentifierB, 'Location', locationB, orgB, 'g', 4),
    ],
    [
      holdingIdentifierB,
      makeIdentifier(holdingIdentifierB, 'Holding', holdingB, orgB, 'h', 5),
    ],
    [
      itemIdentifierB,
      makeIdentifier(itemIdentifierB, 'Item', itemB, orgB, 'i', 6),
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

  function deleteEntity(entityType: string, entityId: string): EntityRecord {
    const entity = entities.get(`${entityType}:${entityId}`);
    if (!entity)
      throw new Error(`Missing test entity ${entityType}:${entityId}`);

    const cascadeChildren: Record<
      string,
      { childType: string; key: keyof EntityRecord }
    > = {
      Work: { childType: 'Edition', key: 'workId' },
      Edition: { childType: 'Holding', key: 'editionId' },
      Holding: { childType: 'Item', key: 'holdingId' },
      Library: { childType: 'Location', key: 'libraryId' },
    };
    if (entityType === 'Location') {
      const hasHoldings = [...entities.values()].some(
        (candidate) =>
          candidate.entityType === 'Holding' &&
          candidate.locationId === entityId,
      );
      if (hasHoldings) {
        throw new Prisma.PrismaClientKnownRequestError(
          'The operation violates a related resource reference.',
          { code: 'P2003', clientVersion: 'test' },
        );
      }
    }
    const relation = cascadeChildren[entityType];
    if (relation) {
      const children = [...entities.values()].filter(
        (candidate) =>
          candidate.entityType === relation.childType &&
          candidate[relation.key] === entityId,
      );
      for (const child of children) {
        deleteEntity(child.entityType, child.id);
      }
    }
    entities.delete(`${entityType}:${entityId}`);
    return entity;
  }

  const entityModels = Object.fromEntries(
    (
      [
        ['work', 'Work'],
        ['edition', 'Edition'],
        ['library', 'Library'],
        ['location', 'Location'],
        ['holding', 'Holding'],
        ['item', 'Item'],
      ] as const
    ).map(([model, entityType]) => [
      model,
      {
        findUnique: async ({ where }: { where: { id: string } }) =>
          entityOrganization(entityType, where.id),
        findMany: async ({
          where,
        }: {
          where: Record<string, string | { in: string[] }>;
        }) =>
          [...entities.values()]
            .filter(
              (entity) =>
                entity.entityType === entityType &&
                Object.entries(where).every(([key, expected]) =>
                  typeof expected === 'string'
                    ? entity[key as keyof EntityRecord] === expected
                    : expected.in.includes(
                        entity[key as keyof EntityRecord] as string,
                      ),
                ),
            )
            .map(({ id }) => ({ id })),
        findFirst: async ({ where }: { where: Record<string, string> }) => {
          const entity = [...entities.values()].find(
            (candidate) =>
              candidate.entityType === entityType &&
              Object.entries(where).every(
                ([key, expected]) =>
                  candidate[key as keyof EntityRecord] === expected,
              ),
          );
          return entity ? { id: entity.id } : null;
        },
        delete: async ({ where }: { where: { id: string } }) =>
          deleteEntity(entityType, where.id),
      },
    ]),
  ) as Record<
    'work' | 'edition' | 'library' | 'location' | 'holding' | 'item',
    {
      findUnique: (args: { where: { id: string } }) => Promise<unknown>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
    }
  >;
  const prisma: Record<string, any> = {
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
      deleteMany: async ({
        where,
      }: {
        where: {
          entityType: string;
          entityId: string | { in: string[] };
        };
      }) => {
        let count = 0;
        for (const [id, row] of identifiers) {
          const matchesEntityId =
            typeof where.entityId === 'string'
              ? row.entityId === where.entityId
              : where.entityId.in.includes(row.entityId);
          if (row.entityType === where.entityType && matchesEntityId) {
            identifiers.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    $transaction: async (
      callback: (client: Record<string, unknown>) => Promise<unknown>,
    ) => {
      const identifierSnapshot = new Map(identifiers);
      const entitySnapshot = new Map(entities);
      try {
        return await callback(prisma);
      } catch (error) {
        identifiers.clear();
        identifierSnapshot.forEach((row, id) => identifiers.set(id, row));
        entities.clear();
        entitySnapshot.forEach((row, id) => entities.set(id, row));
        throw error;
      }
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
      .expect(({ body }) => {
        expect(body.items.map((row: IdentifierRecord) => row.id)).toEqual([
          itemIdentifierB,
          holdingIdentifierB,
          locationIdentifierB,
          libraryIdentifierB,
          editionIdentifierB,
          workIdentifierB,
        ]);
        expect(
          body.items.every(
            (row: IdentifierRecord) => row.organizationId === orgB,
          ),
        ).toBe(true);
      });
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
    expect(state.identifiers.size).toBe(15);
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
        authority: 'doi',
        value: 'same-entity-different-authority',
      })
      .expect(201);
    expect(state.identifiers.size).toBe(before + 1);

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
    expect(state.identifiers.size).toBe(before + 1);
  });

  it.each([
    ['Work', 'works', workA],
    ['Edition', 'editions', editionA],
    ['Library', 'libraries', libraryA],
    ['Location', 'locations', locationA],
    ['Holding', 'holdings', holdingA],
    ['Item', 'items', itemA],
  ] as const)(
    'removes %s External Identifiers in the same transaction as the entity',
    async (entityType, path, entityId) => {
      const created = await request(app.getHttpServer())
        .post('/external-identifiers')
        .set(header, orgA)
        .send({ entityType, entityId, authority: 'local', value: 'cleanup-1' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/external-identifiers')
        .set(header, orgA)
        .send({ entityType, entityId, authority: 'doi', value: 'cleanup-2' })
        .expect(201);
      const survivorsBefore = [...state.identifiers.values()].filter(
        (row) => row.entityType !== entityType || row.entityId !== entityId,
      ).length;

      const ownedBefore = [...state.identifiers.values()].filter(
        (row) => row.entityType === entityType && row.entityId === entityId,
      ).length;

      userId = 'user-b';
      await request(app.getHttpServer())
        .delete(`/${path}/${entityId}`)
        .set(header, orgB)
        .expect(({ status }) => expect([403, 404, 409]).toContain(status));
      expect(
        [...state.identifiers.values()].filter(
          (row) => row.entityType === entityType && row.entityId === entityId,
        ),
      ).toHaveLength(ownedBefore);

      userId = 'user-a';
      await request(app.getHttpServer())
        .delete(`/${path}/${entityId}`)
        .set(header, orgA)
        .expect(200);

      expect(state.entities.has(`${entityType}:${entityId}`)).toBe(false);
      expect(
        [...state.identifiers.values()].filter(
          (row) => row.entityType === entityType && row.entityId === entityId,
        ),
      ).toHaveLength(0);
      expect(state.identifiers.size).toBe(survivorsBefore);
      await request(app.getHttpServer())
        .get(`/external-identifiers/${created.body.id}`)
        .set(header, orgA)
        .expect(404)
        .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
      await request(app.getHttpServer())
        .get('/external-identifiers')
        .set(header, orgB)
        .expect(200)
        .expect(({ body }) =>
          expect(body.items).toHaveLength(
            [...state.identifiers.values()].filter(
              (row) => row.organizationId === orgB,
            ).length,
          ),
        );
    },
  );

  it.each([
    {
      name: 'Work → Edition → Holding → Item',
      path: `/works/${cascadeWork}`,
      removedEntities: [
        ['Work', cascadeWork],
        ['Edition', cascadeEdition],
        ['Holding', cascadeHolding],
        ['Item', cascadeItem],
      ],
      removedIdentifiers: [
        cascadeWorkIdentifier,
        cascadeEditionIdentifier,
        cascadeHoldingIdentifier,
        cascadeItemIdentifier,
      ],
    },
    {
      name: 'Edition → Holding → Item',
      path: `/editions/${cascadeEdition}`,
      removedEntities: [
        ['Edition', cascadeEdition],
        ['Holding', cascadeHolding],
        ['Item', cascadeItem],
      ],
      removedIdentifiers: [
        cascadeEditionIdentifier,
        cascadeHoldingIdentifier,
        cascadeItemIdentifier,
      ],
    },
    {
      name: 'Holding → Item',
      path: `/holdings/${cascadeHolding}`,
      removedEntities: [
        ['Holding', cascadeHolding],
        ['Item', cascadeItem],
      ],
      removedIdentifiers: [cascadeHoldingIdentifier, cascadeItemIdentifier],
    },
    {
      name: 'Library → Location',
      path: `/libraries/${cascadeLibrary}`,
      removedEntities: [
        ['Library', cascadeLibrary],
        ['Location', cascadeLocation],
      ],
      removedIdentifiers: [cascadeLibraryIdentifier, cascadeLocationIdentifier],
    },
    {
      name: 'Location without Holdings',
      path: `/locations/${cascadeLocation}`,
      removedEntities: [['Location', cascadeLocation]],
      removedIdentifiers: [cascadeLocationIdentifier],
    },
  ])(
    'removes descendant identifiers for $name',
    async ({ path, removedEntities, removedIdentifiers }) => {
      removedEntities.forEach(([entityType, entityId], index) => {
        const identifierId = removedIdentifiers[index];
        state.identifiers.set(
          identifierId,
          makeIdentifier(
            identifierId,
            entityType,
            entityId,
            orgA,
            `cascade-${index}`,
            index + 1,
          ),
        );
      });
      await request(app.getHttpServer())
        .delete(path)
        .set(header, orgA)
        .expect(200);

      for (const [entityType, entityId] of removedEntities) {
        expect(state.entities.has(`${entityType}:${entityId}`)).toBe(false);
      }
      for (const identifierId of removedIdentifiers) {
        expect(state.identifiers.has(identifierId)).toBe(false);
      }
      expect(state.identifiers.has(workIdentifierB)).toBe(true);
      expect(state.entities.has(`Work:${workB}`)).toBe(true);
      await request(app.getHttpServer())
        .get(`/external-identifiers/${removedIdentifiers[0]}`)
        .set(header, orgA)
        .expect(404)
        .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    },
  );

  it('preserves Location, Holding, Item and all identifiers when Restrict blocks deletion', async () => {
    for (const [index, [entityType, entityId, identifierId]] of [
      ['Library', restrictedLibrary, restrictedLibraryIdentifier],
      ['Location', restrictedLocation, restrictedLocationIdentifier],
      ['Holding', restrictedHolding, restrictedHoldingIdentifier],
      ['Item', restrictedItem, restrictedItemIdentifier],
    ].entries()) {
      state.identifiers.set(
        identifierId,
        makeIdentifier(
          identifierId,
          entityType,
          entityId,
          orgA,
          `restricted-${index}`,
          index + 1,
        ),
      );
    }
    await request(app.getHttpServer())
      .delete(`/libraries/${restrictedLibrary}`)
      .set(header, orgA)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CONFLICT_FOREIGN_KEY_REFERENCE'),
      );
    for (const [entityType, entityId] of [
      ['Library', restrictedLibrary],
      ['Location', restrictedLocation],
      ['Holding', restrictedHolding],
      ['Item', restrictedItem],
    ]) {
      expect(state.entities.has(`${entityType}:${entityId}`)).toBe(true);
    }
    for (const identifierId of [
      restrictedLibraryIdentifier,
      restrictedLocationIdentifier,
      restrictedHoldingIdentifier,
      restrictedItemIdentifier,
    ]) {
      expect(state.identifiers.has(identifierId)).toBe(true);
      await request(app.getHttpServer())
        .get(`/external-identifiers/${identifierId}`)
        .set(header, orgA)
        .expect(200);
    }

    await request(app.getHttpServer())
      .delete(`/locations/${restrictedLocation}`)
      .set(header, orgA)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CONFLICT_FOREIGN_KEY_REFERENCE'),
      );

    for (const [entityType, entityId] of [
      ['Location', restrictedLocation],
      ['Holding', restrictedHolding],
      ['Item', restrictedItem],
    ]) {
      expect(state.entities.has(`${entityType}:${entityId}`)).toBe(true);
    }
    for (const identifierId of [
      restrictedLibraryIdentifier,
      restrictedLocationIdentifier,
      restrictedHoldingIdentifier,
      restrictedItemIdentifier,
    ]) {
      expect(state.identifiers.has(identifierId)).toBe(true);
      await request(app.getHttpServer())
        .get(`/external-identifiers/${identifierId}`)
        .set(header, orgA)
        .expect(200);
    }
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
