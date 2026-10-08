import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const orgA = `c${'a'.repeat(24)}`;
const orgB = `c${'b'.repeat(24)}`;
const libraryAId = `c${'1'.repeat(24)}`;
const libraryBId = `c${'2'.repeat(24)}`;
const locationAId = `c${'3'.repeat(24)}`;
const locationBId = `c${'4'.repeat(24)}`;
const workAId = `c${'5'.repeat(24)}`;
const workBId = `c${'6'.repeat(24)}`;
const editionAId = `c${'7'.repeat(24)}`;
const editionBId = `c${'8'.repeat(24)}`;
const holdingAId = `c${'9'.repeat(24)}`;
const holdingBId = `c${'d'.repeat(24)}`;
const itemAId = `c${'e'.repeat(24)}`;
const itemBId = `c${'f'.repeat(24)}`;
const header = 'X-Folio-Organization-Id';

type Row = {
  id: string;
  name?: string;
  organizationId?: string;
  libraryId?: string;
  editionId?: string;
  locationId?: string;
  holdingId?: string;
  label?: string | null;
  status?: string;
  notes?: string | null;
  callNumber?: string | null;
  organization?: Row;
  library?: Row;
  work?: Row;
  edition?: Row;
  location?: Row;
  holding?: Row;
  items?: Row[];
};

function makeInventory() {
  const orgs = new Map<string, Row>([
    [orgA, { id: orgA, name: 'Organization A' }],
    [orgB, { id: orgB, name: 'Organization B' }],
  ]);
  const libraries = new Map<string, Row>([
    [
      libraryAId,
      {
        id: libraryAId,
        name: 'Library A',
        organizationId: orgA,
        organization: orgs.get(orgA)!,
      },
    ],
    [
      libraryBId,
      {
        id: libraryBId,
        name: 'Library B',
        organizationId: orgB,
        organization: orgs.get(orgB)!,
      },
    ],
  ]);
  const locations = new Map<string, Row>([
    [
      locationAId,
      {
        id: locationAId,
        name: 'Location A',
        libraryId: libraryAId,
        library: libraries.get(libraryAId)!,
      },
    ],
    [
      locationBId,
      {
        id: locationBId,
        name: 'Location B',
        libraryId: libraryBId,
        library: libraries.get(libraryBId)!,
      },
    ],
  ]);
  const works = new Map<string, Row>([
    [workAId, { id: workAId, organizationId: orgA }],
    [workBId, { id: workBId, organizationId: orgB }],
  ]);
  const editions = new Map<string, Row>([
    [
      editionAId,
      { id: editionAId, workId: workAId, work: works.get(workAId)! },
    ],
    [
      editionBId,
      { id: editionBId, workId: workBId, work: works.get(workBId)! },
    ],
  ]);
  const holdings = new Map<string, Row>([
    [
      holdingAId,
      {
        id: holdingAId,
        editionId: editionAId,
        locationId: locationAId,
        edition: editions.get(editionAId)!,
        location: locations.get(locationAId)!,
        notes: null,
        items: [],
      },
    ],
    [
      holdingBId,
      {
        id: holdingBId,
        editionId: editionBId,
        locationId: locationBId,
        edition: editions.get(editionBId)!,
        location: locations.get(locationBId)!,
        notes: null,
        items: [],
      },
    ],
  ]);
  const items = new Map<string, Row>([
    [
      itemAId,
      {
        id: itemAId,
        holdingId: holdingAId,
        label: 'Copy A',
        status: 'OWNED',
        notes: null,
        holding: holdings.get(holdingAId)!,
      },
    ],
    [
      itemBId,
      {
        id: itemBId,
        holdingId: holdingBId,
        label: 'Copy B',
        status: 'OWNED',
        notes: null,
        holding: holdings.get(holdingBId)!,
      },
    ],
  ]);
  const memberRows = [
    { userId: 'user-a', organizationId: orgA, role: 'OWNER' },
    { userId: 'user-a', organizationId: orgB, role: 'STAFF' },
    { userId: 'user-b', organizationId: orgB, role: 'READER' },
    { userId: 'user-c', organizationId: orgA, role: 'STAFF' },
  ];

  const prisma = {
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orgs.get(where.id) ?? null,
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
        const row = memberRows.find(
          (entry) =>
            entry.userId === key.userId &&
            entry.organizationId === key.organizationId,
        );
        return row
          ? { ...row, organization: orgs.get(key.organizationId) }
          : null;
      },
      findMany: async () => [],
    },
    library: {
      findMany: async ({ where }: { where: { organizationId: string } }) =>
        [...libraries.values()].filter(
          (row) => row.organizationId === where.organizationId,
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        libraries.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: { organizationId: string; name: string };
      }) => {
        const row = {
          id: `c${'a'.repeat(23)}1`,
          ...data,
          organization: orgs.get(data.organizationId)!,
        };
        libraries.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => Object.assign(libraries.get(where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) =>
        libraries.get(where.id)!,
    },
    location: {
      findMany: async ({
        where,
      }: {
        where: { library: { organizationId: string } };
      }) =>
        [...locations.values()].filter(
          (row) => row.library?.organizationId === where.library.organizationId,
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        locations.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: { libraryId: string; name: string };
      }) => {
        const row = {
          id: `c${'b'.repeat(23)}1`,
          ...data,
          library: libraries.get(data.libraryId)!,
        };
        locations.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => Object.assign(locations.get(where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) =>
        locations.get(where.id)!,
    },
    work: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        works.get(where.id) ?? null,
    },
    edition: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        editions.get(where.id) ?? null,
    },
    holding: {
      findMany: async ({
        where,
      }: {
        where: {
          edition: { work: { organizationId: string } };
          location: { library: { organizationId: string } };
          editionId?: string;
          locationId?: string;
        };
      }) =>
        [...holdings.values()].filter(
          (row) =>
            row.edition?.work?.organizationId ===
              where.edition.work.organizationId &&
            row.location?.library?.organizationId ===
              where.location.library.organizationId &&
            (!where.editionId || row.editionId === where.editionId) &&
            (!where.locationId || row.locationId === where.locationId),
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        holdings.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: {
          editionId: string;
          locationId: string;
          callNumber?: string | null;
          notes?: string | null;
        };
      }) => {
        const row = {
          id: `c${'c'.repeat(23)}1`,
          ...data,
          edition: editions.get(data.editionId)!,
          location: locations.get(data.locationId)!,
          items: [],
        };
        holdings.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => Object.assign(holdings.get(where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) =>
        holdings.get(where.id)!,
    },
    item: {
      findMany: async ({
        where,
      }: {
        where: {
          holding: {
            edition: { work: { organizationId: string } };
            location: { library: { organizationId: string } };
          };
        };
      }) =>
        [...items.values()].filter(
          (row) =>
            row.holding?.edition?.work?.organizationId ===
              where.holding.edition.work.organizationId &&
            row.holding?.location?.library?.organizationId ===
              where.holding.location.library.organizationId,
        ),
      findUnique: async ({ where }: { where: { id: string } }) =>
        items.get(where.id) ?? null,
      create: async ({
        data,
      }: {
        data: {
          holdingId: string;
          label?: string | null;
          status?: string;
          notes?: string | null;
        };
      }) => {
        const row = {
          id: `c${'9'.repeat(22)}a1`,
          ...data,
          holding: holdings.get(data.holdingId)!,
        };
        items.set(row.id, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => Object.assign(items.get(where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) =>
        items.get(where.id)!,
    },
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };

  return { prisma, libraries, locations, works, editions, holdings, items };
}

async function expectSameNotFound<
  T extends {
    status: number;
    body: { code: string; message: string };
  },
>(inaccessible: PromiseLike<T>, nonexistent: PromiseLike<T>): Promise<void> {
  const [inaccessibleResponse, nonexistentResponse] = await Promise.all([
    inaccessible,
    nonexistent,
  ]);
  const identity = (response: T) => ({
    status: response.status,
    code: response.body.code,
    message: response.body.message,
  });
  expect(identity(inaccessibleResponse)).toEqual(identity(nonexistentResponse));
}

describe('Physical inventory routes (e2e)', () => {
  let app: INestApplication<App>;
  let userId = 'user-a';
  let inventory: ReturnType<typeof makeInventory>;

  beforeEach(async () => {
    userId = 'user-a';
    inventory = makeInventory();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(inventory.prisma)
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
    app.use((_request, _response, next) => {
      _request.headers['user-agent'] = 'node-fetch';
      next();
    });
    await app.init();
  }, 20_000);

  afterEach(async () => app.close());

  it('scopes Libraries to one organization, derives resource access, and authorizes writes before mutation', async () => {
    await request(app.getHttpServer())
      .get('/libraries')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/libraries')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: Row) => row.id)).toEqual([libraryAId]),
      );
    await request(app.getHttpServer())
      .get('/libraries')
      .set(header, 'malformed')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
    await request(app.getHttpServer())
      .get('/libraries')
      .set(header, orgA)
      .query({ organizationId: orgB })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .get(`/libraries/${libraryAId}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/libraries/${libraryAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/libraries/${libraryAId}`)
      .set(header, orgB)
      .send({ name: 'Mismatch' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .delete(`/libraries/${libraryAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .post('/libraries')
      .set(header, orgA)
      .send({ name: 'New library' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/libraries')
      .set(header, orgA)
      .send({ name: 'Forged tenant', organizationId: orgB })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .put(`/libraries/${libraryAId}`)
      .set(header, orgA)
      .send({ name: 'Renamed A' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/libraries/${libraryAId}`)
      .set(header, orgA)
      .expect(200);
    userId = 'user-b';
    await request(app.getHttpServer())
      .get('/libraries')
      .set(header, orgA)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get(`/libraries/${libraryAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .put(`/libraries/${libraryAId}`)
      .send({ name: 'Non-member cannot rename' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .delete(`/libraries/${libraryAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .post('/libraries')
      .set(header, orgA)
      .send({ name: 'Non-member cannot create' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    const before = inventory.libraries.size;
    await request(app.getHttpServer())
      .post('/libraries')
      .set(header, orgB)
      .send({ name: 'Reader cannot create' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    expect(inventory.libraries.size).toBe(before);
  });

  it('scopes Locations and derives child creation from Library with optional header consistency', async () => {
    await request(app.getHttpServer())
      .get('/locations')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/locations')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: Row) => row.id)).toEqual([locationAId]),
      );
    await request(app.getHttpServer())
      .get('/locations')
      .set(header, orgA)
      .query({ libraryId: libraryBId })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .get(`/locations/${locationAId}`)
      .set(header, orgA)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/locations/${locationAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/locations/${locationAId}`)
      .set(header, orgB)
      .send({ name: 'Mismatch' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .delete(`/locations/${locationAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .post('/locations')
      .send({ libraryId: libraryAId, name: 'New stack' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/locations')
      .set(header, orgA)
      .send({ libraryId: libraryAId, name: 'Matching header' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/locations')
      .send({
        libraryId: libraryAId,
        name: 'Competing tenant',
        organizationId: orgB,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .put(`/locations/${locationAId}`)
      .set(header, orgA)
      .send({ name: 'Renamed location' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/locations/${locationAId}`)
      .set(header, orgA)
      .expect(200);
    const before = inventory.locations.size;
    await request(app.getHttpServer())
      .post('/locations')
      .set(header, orgB)
      .send({ libraryId: libraryAId, name: 'Mismatch' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .post('/locations')
      .send({ libraryId: 'missing-library', name: 'Missing parent' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    expect(inventory.locations.size).toBe(before);
    userId = 'user-b';
    await request(app.getHttpServer())
      .post('/locations')
      .send({ libraryId: libraryAId, name: 'Out of tenant' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .get(`/locations/${locationAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .put(`/locations/${locationAId}`)
      .send({ name: 'Non-member cannot rename' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .delete(`/locations/${locationAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .put(`/locations/${locationBId}`)
      .send({ name: 'Reader cannot rename' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
  });

  it('scopes Holdings, validates both persisted parents, and rejects non-member or READER writes', async () => {
    await request(app.getHttpServer())
      .get('/holdings')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/holdings')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: Row) => row.id)).toEqual([holdingAId]),
      );
    await request(app.getHttpServer())
      .get('/holdings')
      .set(header, orgA)
      .query({ locationId: locationBId })
      .expect(200)
      .expect(({ body }) => expect(body.items).toEqual([]));
    await request(app.getHttpServer())
      .get('/holdings')
      .set(header, orgA)
      .query({ organizationId: orgB })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .get(`/holdings/${holdingAId}`)
      .set(header, orgA)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/holdings/${holdingAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/holdings/${holdingAId}`)
      .set(header, orgB)
      .send({ notes: 'Mismatch' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .delete(`/holdings/${holdingAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    await request(app.getHttpServer())
      .post('/holdings')
      .send({
        editionId: editionAId,
        locationId: locationAId,
        callNumber: 'QA76',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/holdings')
      .set(header, orgA)
      .send({ editionId: editionAId, locationId: locationAId })
      .expect(201);
    await request(app.getHttpServer())
      .post('/holdings')
      .send({
        editionId: editionAId,
        locationId: locationAId,
        organizationId: orgA,
        libraryId: libraryAId,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_INVALID_BODY',
        });
        expect(body.message).toEqual(expect.any(String));
      });
    const before = inventory.holdings.size;
    await request(app.getHttpServer())
      .post('/holdings')
      .send({ editionId: editionAId, locationId: locationBId })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .post('/holdings')
      .send({ editionId: 'missing-edition', locationId: locationAId })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .post('/holdings')
      .send({ editionId: editionAId, locationId: 'missing-location' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .post('/holdings')
      .set(header, orgB)
      .send({ editionId: editionAId, locationId: locationAId })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/holdings/${holdingAId}`)
      .set(header, orgA)
      .send({ notes: 'Updated holding' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/holdings/${holdingAId}`)
      .set(header, orgA)
      .expect(200);
    expect(inventory.holdings.size).toBe(before);

    const inconsistent = inventory.holdings.get(holdingAId)!;
    inconsistent.location = inventory.locations.get(locationBId)!;
    await request(app.getHttpServer())
      .get(`/holdings/${holdingAId}`)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    inconsistent.location = inventory.locations.get(locationAId)!;

    userId = 'user-b';
    await request(app.getHttpServer())
      .get(`/holdings/${holdingAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .put(`/holdings/${holdingAId}`)
      .send({ notes: 'Non-member cannot edit' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .delete(`/holdings/${holdingAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .post('/holdings')
      .send({ editionId: editionAId, locationId: locationAId })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .post('/holdings')
      .send({ editionId: editionBId, locationId: locationBId })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );

    const sameNotFound = expectSameNotFound;
    await sameNotFound(
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: editionAId, locationId: locationBId }),
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: 'missing-edition', locationId: locationBId }),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: editionAId, locationId: editionAId }),
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: 'missing-edition', locationId: locationAId }),
    );
    userId = 'user-c';
    await sameNotFound(
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: editionAId, locationId: locationBId }),
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: editionAId, locationId: 'missing-location' }),
    );
    expect(inventory.holdings.size).toBe(before);
  });

  it('scopes Items through Holding, derives projections, and enforces membership, header consistency, and write roles', async () => {
    await request(app.getHttpServer())
      .get('/items')
      .expect(400)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_REQUIRED'),
      );
    await request(app.getHttpServer())
      .get('/items')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: Row) => row.id)).toEqual([itemAId]),
      );

    const created = await request(app.getHttpServer())
      .post('/items')
      .send({
        holdingId: holdingAId,
        label: 'Copy created',
        notes: 'Copy note',
      })
      .expect(201);
    expect(created.body.holding.edition.work.organizationId).toBe(orgA);
    expect(created.body.holding.location.library.organizationId).toBe(orgA);
    await request(app.getHttpServer())
      .post('/items')
      .set(header, orgA)
      .send({ holdingId: holdingAId, label: 'Matching context' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/items')
      .set(header, orgA)
      .query({ holdingId: holdingBId })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .post('/items')
      .send({
        holdingId: holdingAId,
        organizationId: orgA,
        editionId: editionAId,
        libraryId: libraryAId,
        locationId: locationAId,
      })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    await request(app.getHttpServer())
      .post('/items')
      .send({ holdingId: holdingAId, status: null })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_INVALID_BODY'));
    const before = inventory.items.size;
    await request(app.getHttpServer())
      .post('/items')
      .set(header, orgB)
      .send({ holdingId: holdingAId })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    expect(inventory.items.size).toBe(before);

    await request(app.getHttpServer())
      .get(`/items/${itemAId}`)
      .set(header, orgA)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/items/${itemAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/items/${itemAId}`)
      .set(header, orgB)
      .send({ label: 'Denied' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .delete(`/items/${itemAId}`)
      .set(header, orgB)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
    await request(app.getHttpServer())
      .put(`/items/${itemAId}`)
      .set(header, orgA)
      .send({ label: 'Updated A', notes: 'Updated note' })
      .expect(200);

    userId = 'user-b';
    await request(app.getHttpServer())
      .get(`/items/${itemAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .put(`/items/${itemAId}`)
      .send({ label: 'Non-member cannot edit' })
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .delete(`/items/${itemAId}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
    await request(app.getHttpServer())
      .put(`/items/${itemBId}`)
      .send({ label: 'Reader denied' })
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    await request(app.getHttpServer())
      .delete(`/items/${itemBId}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_ROLE_INSUFFICIENT'),
      );
    userId = 'user-a';
    await request(app.getHttpServer())
      .delete(`/items/${itemAId}`)
      .set(header, orgA)
      .expect(200);
  });

  it('masks Inventory resource and parent existence from non-members', async () => {
    userId = 'user-b';
    const missingId = `c${'0'.repeat(24)}`;
    const sameNotFound = expectSameNotFound;

    await sameNotFound(
      request(app.getHttpServer()).get(`/libraries/${libraryAId}`),
      request(app.getHttpServer()).get(`/libraries/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .put(`/libraries/${libraryAId}`)
        .send({ name: 'No write' }),
      request(app.getHttpServer())
        .put(`/libraries/${missingId}`)
        .send({ name: 'No write' }),
    );
    await sameNotFound(
      request(app.getHttpServer()).delete(`/libraries/${libraryAId}`),
      request(app.getHttpServer()).delete(`/libraries/${missingId}`),
    );

    await sameNotFound(
      request(app.getHttpServer()).get(`/locations/${locationAId}`),
      request(app.getHttpServer()).get(`/locations/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .put(`/locations/${locationAId}`)
        .send({ name: 'No write' }),
      request(app.getHttpServer())
        .put(`/locations/${missingId}`)
        .send({ name: 'No write' }),
    );
    await sameNotFound(
      request(app.getHttpServer()).delete(`/locations/${locationAId}`),
      request(app.getHttpServer()).delete(`/locations/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .post('/locations')
        .send({ libraryId: libraryAId, name: 'No write' }),
      request(app.getHttpServer())
        .post('/locations')
        .send({ libraryId: missingId, name: 'No write' }),
    );

    await sameNotFound(
      request(app.getHttpServer()).get(`/holdings/${holdingAId}`),
      request(app.getHttpServer()).get(`/holdings/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .put(`/holdings/${holdingAId}`)
        .send({ notes: 'No write' }),
      request(app.getHttpServer())
        .put(`/holdings/${missingId}`)
        .send({ notes: 'No write' }),
    );
    await sameNotFound(
      request(app.getHttpServer()).delete(`/holdings/${holdingAId}`),
      request(app.getHttpServer()).delete(`/holdings/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: editionAId, locationId: locationAId }),
      request(app.getHttpServer())
        .post('/holdings')
        .send({ editionId: missingId, locationId: locationAId }),
    );

    await sameNotFound(
      request(app.getHttpServer()).get(`/items/${itemAId}`),
      request(app.getHttpServer()).get(`/items/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .put(`/items/${itemAId}`)
        .send({ label: 'No write' }),
      request(app.getHttpServer())
        .put(`/items/${missingId}`)
        .send({ label: 'No write' }),
    );
    await sameNotFound(
      request(app.getHttpServer()).delete(`/items/${itemAId}`),
      request(app.getHttpServer()).delete(`/items/${missingId}`),
    );
    await sameNotFound(
      request(app.getHttpServer())
        .post('/items')
        .send({ holdingId: holdingAId }),
      request(app.getHttpServer())
        .post('/items')
        .send({ holdingId: missingId }),
    );

    expect(inventory.libraries.get(libraryAId)?.name).toBe('Library A');
    expect(inventory.locations.get(locationAId)?.name).toBe('Location A');
    expect(inventory.holdings.get(holdingAId)?.notes).toBeNull();
    expect(inventory.items.get(itemAId)?.label).toBe('Copy A');
    expect(inventory.libraries.size).toBe(2);
    expect(inventory.locations.size).toBe(2);
    expect(inventory.holdings.size).toBe(2);
    expect(inventory.items.size).toBe(2);
  });

  it('excludes inconsistent Holding and Item rows from root lists even when one ownership path matches', async () => {
    const inconsistentHolding = inventory.holdings.get(holdingAId)!;
    inconsistentHolding.location = inventory.locations.get(locationBId)!;

    await request(app.getHttpServer())
      .get('/holdings')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) => expect(body.items).toEqual([]));

    await request(app.getHttpServer())
      .get('/items')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) => expect(body.items).toEqual([]));

    inconsistentHolding.location = inventory.locations.get(locationAId)!;
    const consistentHoldingB = inventory.holdings.get(holdingBId)!;
    consistentHoldingB.edition = inventory.editions.get(editionAId)!;

    await request(app.getHttpServer())
      .get('/holdings')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: Row) => row.id)).toEqual([holdingAId]),
      );

    await request(app.getHttpServer())
      .get('/items')
      .set(header, orgA)
      .expect(200)
      .expect(({ body }) =>
        expect(body.items.map((row: Row) => row.id)).toEqual([itemAId]),
      );
  });

  it('returns the stable error envelope for context and consistency failures', async () => {
    await request(app.getHttpServer())
      .get('/items')
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

  it('validates supplied header syntax before looking up a derived resource or parent', async () => {
    const missingId = `c${'0'.repeat(24)}`;

    await request(app.getHttpServer())
      .get(`/libraries/${missingId}`)
      .set(header, 'malformed')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
    await request(app.getHttpServer())
      .post('/locations')
      .set(header, 'malformed')
      .send({ libraryId: 'missing-library', name: 'No write' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
  });
});
