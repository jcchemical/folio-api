import { Readable } from 'node:stream';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { vi } from 'vitest';
import { hashPassword } from '../src/auth/password.utils.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../src/storage/storage.service.js';

const memberId = 'cover-member';
const secondMemberId = 'cover-member-b';
const outsiderId = 'cover-outsider';
const password = 'cover-integration-test-password';
const editionId = `c${'a'.repeat(24)}`;
const secondEditionId = `c${'d'.repeat(24)}`;
const organizationId = `c${'b'.repeat(24)}`;
const otherOrganizationId = `c${'c'.repeat(24)}`;
const organizationHeader = 'X-Folio-Organization-Id';
const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const contentHash = 'sha256-cover-content-hash';

describe('GET /editions/:id/cover (e2e)', () => {
  let app: INestApplication<App>;
  let state: {
    editionExists: boolean;
    coverExists: boolean;
    memberAllowed: boolean;
    memberRole: string;
    storageFailure: boolean;
  };
  let storage: StorageService;

  beforeEach(async () => {
    state = {
      editionExists: true,
      coverExists: true,
      memberAllowed: true,
      memberRole: 'OWNER',
      storageFailure: false,
    };
    const passwordHash = await hashPassword(password);
    const users = [
      {
        id: memberId,
        email: 'cover-member@example.test',
        name: 'Cover Member',
        passwordHash,
        refreshToken: null,
        refreshTokenExpires: null,
      },
      {
        id: outsiderId,
        email: 'cover-outsider@example.test',
        name: 'Cover Outsider',
        passwordHash,
        refreshToken: null,
        refreshTokenExpires: null,
      },
      {
        id: secondMemberId,
        email: 'cover-member-b@example.test',
        name: 'Cover Member B',
        passwordHash,
        refreshToken: null,
        refreshTokenExpires: null,
      },
    ];
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
          data: Record<string, unknown>;
        }) => {
          const user = users.find((entry) => entry.id === where.id);
          if (!user) return null;
          Object.assign(user, data);
          return user;
        },
      },
      organizationMembership: {
        findUnique: async ({
          where,
        }: {
          where: {
            userId_organizationId: { userId: string; organizationId: string };
          };
        }) => {
          const { userId, organizationId: requestedOrganizationId } =
            where.userId_organizationId;
          if (
            state.memberAllowed &&
            userId === memberId &&
            requestedOrganizationId === organizationId
          ) {
            return {
              role: state.memberRole,
              organization: { id: organizationId },
            };
          }
          if (
            userId === secondMemberId &&
            requestedOrganizationId === otherOrganizationId
          ) {
            return {
              role: 'READER',
              organization: { id: otherOrganizationId },
            };
          }
          return null;
        },
      },
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === organizationId
            ? { id: organizationId, name: 'Cover organization' }
            : where.id === otherOrganizationId
              ? { id: otherOrganizationId, name: 'Other organization' }
              : null,
      },
      edition: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (!state.editionExists) return null;
          if (where.id === editionId) {
            return { id: editionId, work: { organizationId } };
          }
          if (where.id === secondEditionId) {
            return {
              id: secondEditionId,
              work: { organizationId: otherOrganizationId },
            };
          }
          return null;
        },
      },
      editionCover: {
        findFirst: async ({ where }: { where: { editionId: string } }) =>
          state.coverExists &&
          [editionId, secondEditionId].includes(where.editionId)
            ? {
                coverAsset: {
                  storageKey: `${where.editionId === editionId ? organizationId : otherOrganizationId}/image-key`,
                  contentHash,
                  mimeType: 'image/png',
                },
              }
            : null,
      },
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    };
    storage = {
      save: async () => ({
        storageKey: `${organizationId}/image-key`,
        mimeType: 'image/png',
        sizeBytes: image.length,
      }),
      get: async () => {
        if (state.storageFailure) {
          throw new Error('private-storage-path-must-not-leak');
        }
        return Readable.from([image]);
      },
      delete: async () => undefined,
      exists: async () => true,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(storage)
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

  async function tokenFor(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return response.body.accessToken as string;
  }

  it('serves the active cover with cache and security headers', async () => {
    const token = await tokenFor('cover-member@example.test');
    const response = await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual(image);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers.etag).toBe(`"${contentHash}"`);
    expect(response.headers['cache-control']).toBe('private, max-age=31536000');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('accepts a matching optional organization header', async () => {
    const token = await tokenFor('cover-member@example.test');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .set(organizationHeader, organizationId)
      .expect(200);
  });

  it('rejects a mismatching organization header before reading the asset', async () => {
    const token = await tokenFor('cover-member@example.test');
    const readStorage = vi.spyOn(storage, 'get');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .set(organizationHeader, otherOrganizationId)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );

    expect(readStorage).not.toHaveBeenCalled();
  });

  it('rejects a malformed optional organization header', async () => {
    const token = await tokenFor('cover-member@example.test');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .set(organizationHeader, 'not-a-cuid')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ORGANIZATION_ID_INVALID'));
  });

  it.each(['READER', 'STAFF'])(
    'allows %s membership to read the active cover',
    async (role) => {
      state.memberRole = role;
      const token = await tokenFor('cover-member@example.test');

      await request(app.getHttpServer())
        .get(`/editions/${editionId}/cover`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    },
  );

  it('returns 304 without reading the stored image when If-None-Match matches', async () => {
    const token = await tokenFor('cover-member@example.test');
    const getStorageFile = vi.spyOn(storage, 'get');

    const response = await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .set('If-None-Match', `W/"${contentHash}"`)
      .expect(304);

    expect(response.headers.etag).toBe(`"${contentHash}"`);
    expect(getStorageFile).not.toHaveBeenCalled();
  });

  it('returns COVER_NOT_FOUND when the edition has no active cover', async () => {
    state.coverExists = false;
    const token = await tokenFor('cover-member@example.test');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('COVER_NOT_FOUND'));
  });

  it('returns a sanitized error when stored cover bytes cannot be read', async () => {
    state.storageFailure = true;
    const token = await tokenFor('cover-member@example.test');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .expect(500)
      .expect(({ body }) => {
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(JSON.stringify(body)).not.toContain(
          'private-storage-path-must-not-leak',
        );
      });
  });

  it('returns RESOURCE_NOT_FOUND when the edition does not exist', async () => {
    state.editionExists = false;
    const token = await tokenFor('cover-member@example.test');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  });

  it('forbids users without membership in the edition organization', async () => {
    const token = await tokenFor('cover-outsider@example.test');

    await request(app.getHttpServer())
      .get(`/editions/${editionId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
  });

  it('isolates Editions and active covers across two organizations', async () => {
    const memberAToken = await tokenFor('cover-member@example.test');
    const memberBToken = await tokenFor('cover-member-b@example.test');
    const readStorage = vi.spyOn(storage, 'get');

    await request(app.getHttpServer())
      .get(`/editions/${secondEditionId}/cover`)
      .set('Authorization', `Bearer ${memberAToken}`)
      .expect(403)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_MEMBERSHIP_REQUIRED'),
      );
    expect(readStorage).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get(`/editions/${secondEditionId}/cover`)
      .set('Authorization', `Bearer ${memberBToken}`)
      .expect(200);
    expect(readStorage).toHaveBeenCalledOnce();
  });

  it('rejects IDs that are not CUIDs', async () => {
    const token = await tokenFor('cover-member@example.test');

    await request(app.getHttpServer())
      .get('/editions/not-a-cuid/cover')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
