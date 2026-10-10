import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { XMLParser } from 'fast-xml-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { hashPassword } from '../src/auth/password.utils.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  canonicalExportEdition,
  canonicalExportEditionId,
  canonicalExportOrganizationId,
  legacyFallbackEdition,
  legacyFallbackEditionId,
} from './fixtures/canonical-export-edition.js';

type ParsedField = {
  '@_tag': string;
  '@_ind1': string;
  '@_ind2': string;
  subfield:
    | Array<{ '@_code': string; '#text': string }>
    | { '@_code': string; '#text': string };
};

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
});
const memberId = 'export-member-user';
const outsiderId = 'export-outsider-user';
const password = 'integration-test-password';
const secondOrganizationId = `c${'b'.repeat(24)}`;
const secondEditionId = `c${'d'.repeat(24)}`;
const editionWithoutRecordId = `c${'9'.repeat(24)}`;
const organizationHeader = 'X-Folio-Organization-Id';
const secondOrganizationEdition = {
  ...canonicalExportEdition,
  id: secondEditionId,
  workId: 'export-work-2',
  titles: canonicalExportEdition.titles.map((title) => ({
    ...title,
    value: title.type === 'MAIN' ? 'Tenant B Canonical Title' : title.value,
  })),
  work: {
    ...canonicalExportEdition.work,
    id: 'export-work-2',
    organizationId: secondOrganizationId,
    titles: canonicalExportEdition.work.titles.map((title) => ({
      ...title,
      value: 'Tenant B Canonical Work Title',
    })),
  },
};
const bibliographicRecordEditionIds = new Set([
  canonicalExportEditionId,
  secondEditionId,
  legacyFallbackEditionId,
]);
const editions = new Map<string, unknown>([
  [canonicalExportEditionId, canonicalExportEdition],
  [legacyFallbackEditionId, legacyFallbackEdition],
  [secondEditionId, secondOrganizationEdition],
  [
    editionWithoutRecordId,
    {
      ...canonicalExportEdition,
      id: editionWithoutRecordId,
    },
  ],
]);

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function fieldsByTag(fields: ParsedField[], tag: string): ParsedField[] {
  return fields.filter((field) => field['@_tag'] === tag);
}

function values(field: ParsedField, code: string): string[] {
  return asArray(field.subfield)
    .filter((subfield) => subfield['@_code'] === code)
    .map((subfield) => subfield['#text']);
}

describe('Canonical Edition MARCXchange export (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const passwordHash = await hashPassword(password);
    const users = [
      {
        id: memberId,
        email: 'export-member@example.test',
        name: 'Export Member',
        passwordHash,
        refreshToken: null,
        refreshTokenExpires: null,
      },
      {
        id: outsiderId,
        email: 'export-outsider@example.test',
        name: 'Export Outsider',
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
          const key = where.userId_organizationId;
          const memberOrganization =
            key.userId === memberId &&
            [canonicalExportOrganizationId, secondOrganizationId].includes(
              key.organizationId,
            );
          const secondMemberOrganization =
            key.userId === outsiderId &&
            key.organizationId === secondOrganizationId;
          if (!memberOrganization && !secondMemberOrganization) return null;
          return {
            role: key.userId === memberId ? 'OWNER' : 'READER',
            organization: { id: key.organizationId },
          };
        },
      },
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          [canonicalExportOrganizationId, secondOrganizationId].includes(
            where.id,
          )
            ? { id: where.id, name: where.id }
            : null,
      },
      edition: {
        findUnique: async ({
          where,
          select,
        }: {
          where: { id: string };
          select?: unknown;
        }) => {
          const edition = editions.get(where.id);
          if (!edition) return null;
          if (select) {
            const selected = edition as {
              id: string;
              work: { organizationId: string };
            };
            return {
              id: selected.id,
              work: { organizationId: selected.work.organizationId },
            };
          }
          return edition;
        },
      },
      bibliographicRecord: {
        findFirst: async ({
          where,
        }: {
          where: {
            editionId: string;
            edition: { work: { organizationId: string } };
          };
        }) => {
          const edition = editions.get(where.editionId) as
            { work: { organizationId: string } } | undefined;
          if (
            edition?.work.organizationId !== where.edition.work.organizationId
          ) {
            return null;
          }
          return bibliographicRecordEditionIds.has(where.editionId)
            ? { id: `record-${where.editionId}` }
            : null;
        },
      },
      externalIdentifier: {
        findMany: async ({
          where,
        }: {
          where: {
            entityType: string;
            entityId: string;
            organizationId: string;
          };
        }) => {
          if (where.entityType !== 'Edition') return [];
          const edition = editions.get(where.entityId) as
            | {
                work: { organizationId: string };
                externalIdentifiers?: {
                  type: string;
                  value: string;
                  source?: string | null;
                }[];
              }
            | undefined;
          if (
            !edition ||
            edition.work.organizationId !== where.organizationId
          ) {
            return [];
          }
          return (edition.externalIdentifiers ?? []).map(
            ({ type, value }, index) => ({
              id: `c${String(index + 1).padStart(24, '0')}`,
              entityType: 'Edition',
              entityId: where.entityId,
              authority: type.toLowerCase(),
              value,
              organizationId: where.organizationId,
              createdAt: new Date(0),
              updatedAt: new Date(0),
            }),
          );
        },
      },
      $connect: async () => undefined,
      $disconnect: async () => undefined,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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

  async function accessToken(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return response.body.accessToken as string;
  }

  it('exports canonical Edition fields as structurally valid MARC21 MARCXchange XML', async () => {
    const token = await accessToken('export-member@example.test');
    const response = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${canonicalExportEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/xml/);

    const xml = response.text as string;
    const parsed = parser.parse(xml) as {
      collection: {
        record: {
          '@_format': string;
          leader: string;
          controlfield:
            | { '@_tag': string; '#text': string }
            | { '@_tag': string; '#text': string }[];
          datafield: ParsedField[] | ParsedField;
        };
      };
    };
    const record = parsed.collection.record;
    const fields = asArray(record.datafield);

    expect(xml).toContain('<collection xmlns="info:lc/xmlns/marcxchange-v2">');
    expect(record['@_format']).toBe('MARC21');
    expect(record.leader).toHaveLength(24);
    expect(asArray(record.controlfield)).toContainEqual({
      '@_tag': '001',
      '#text': canonicalExportEditionId,
    });
    expect(values(fieldsByTag(fields, '245')[0], 'a')).toEqual([
      'Canonical Edition Title',
    ]);
    expect(values(fieldsByTag(fields, '245')[0], 'b')).toEqual([
      'Canonical Subtitle',
    ]);
    expect(values(fieldsByTag(fields, '020')[0], 'a')).toEqual([
      '9789724426495',
    ]);
    expect(values(fieldsByTag(fields, '100')[0], 'a')).toEqual(['Silva, Ana']);

    for (const forbidden of [
      'LEGACY EDITION TITLE MUST NOT EXPORT',
      'LEGACY EDITION SUBTITLE MUST NOT EXPORT',
      'LEGACY PUBLISHER MUST NOT EXPORT',
      'LEGACY PLACE MUST NOT EXPORT',
      'LEGACY WORK TITLE MUST NOT EXPORT',
      '9780000000000',
      '0306406152',
      '999 p.',
      'AGENT DISPLAY NAME MUST NOT EXPORT',
      'CORPORATE DISPLAY NAME MUST NOT EXPORT',
      'ITEM PROVENANCE MUST NOT EXPORT',
      'record-123',
      'UNMAPPED SHELF VALUE MUST NOT EXPORT',
      'provider-content',
    ]) {
      expect(xml).not.toContain(forbidden);
    }
    expect(xml).not.toContain('<warning');
    expect(xml).not.toContain('<diagnostic');
    expect(fieldsByTag(fields, '966')).toHaveLength(0);
  }, 30_000);

  it('does not fall back to transitional scalar fields when canonical data is absent', async () => {
    const token = await accessToken('export-member@example.test');
    const response = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${legacyFallbackEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const parsed = parser.parse(response.text as string) as {
      collection: { record: { datafield: ParsedField[] | ParsedField } };
    };
    expect(parsed.collection.record.datafield).toBeUndefined();
    expect(response.text).not.toContain('Legacy fallback');
  }, 30_000);

  it('accepts a matching optional organization header and rejects a mismatch', async () => {
    const token = await accessToken('export-member@example.test');

    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${canonicalExportEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .set(organizationHeader, canonicalExportOrganizationId)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${canonicalExportEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .set(organizationHeader, secondOrganizationId)
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('ORGANIZATION_CONTEXT_CONFLICT'),
      );
  }, 30_000);

  it('exports only the requested Edition for a user in both organizations', async () => {
    const token = await accessToken('export-member@example.test');
    const organizationAResponse = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${canonicalExportEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const organizationBResponse = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${secondEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(organizationAResponse.text).toContain('Canonical Edition Title');
    expect(organizationAResponse.text).not.toContain(
      'Tenant B Canonical Title',
    );
    expect(organizationBResponse.text).toContain('Tenant B Canonical Title');
    expect(organizationBResponse.text).not.toContain('Canonical Edition Title');
  }, 30_000);

  it('allows a Reader to export the canonical Edition', async () => {
    const token = await accessToken('export-outsider@example.test');

    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${secondEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/xml/)
      .expect(({ text }) => {
        const parsed = parser.parse(text as string) as {
          collection: { record: { datafield: ParsedField[] | ParsedField } };
        };
        const fields = asArray(parsed.collection.record.datafield);
        expect(values(fieldsByTag(fields, '245')[0], 'a')).toEqual([
          'Tenant B Canonical Title',
        ]);
      });
  }, 30_000);

  it('does not allow a user in Organization B to export Organization A Editions', async () => {
    const token = await accessToken('export-outsider@example.test');

    const inaccessibleEdition = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${canonicalExportEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const missingEdition = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${`c${'0'.repeat(24)}`}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(inaccessibleEdition.body).toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      message: missingEdition.body.message,
    });
    expect(inaccessibleEdition.body.message).toBe(missingEdition.body.message);

    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${secondEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }, 30_000);

  it('requires authentication and returns RESOURCE_NOT_FOUND for a missing Edition', async () => {
    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${canonicalExportEditionId}`)
      .expect(401);

    const outsiderToken = await accessToken('export-outsider@example.test');
    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${`c${'0'.repeat(24)}`}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));

    const memberToken = await accessToken('export-member@example.test');
    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${`c${'0'.repeat(24)}`}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  }, 30_000);

  it('returns RESOURCE_NOT_FOUND when an existing Edition has no Record', async () => {
    const token = await accessToken('export-member@example.test');
    await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${editionWithoutRecordId}`)
      .set('Authorization', 'Bearer ' + token)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('RESOURCE_NOT_FOUND'));
  }, 30_000);
});
