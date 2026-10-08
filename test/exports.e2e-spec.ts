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
const editions = new Map<string, unknown>([
  [canonicalExportEditionId, canonicalExportEdition],
  [legacyFallbackEditionId, legacyFallbackEdition],
  [secondEditionId, secondOrganizationEdition],
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

describe('Local canonical MARCXchange export (e2e)', () => {
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

  it('exports persisted canonical Phase 1 data as valid MARCXchange XML without leaking legacy or source-only values', async () => {
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
          '@_type': string;
          leader: string;
          controlfield: { '@_tag': string; '#text': string };
          datafield: ParsedField[] | ParsedField;
        };
      };
    };
    const record = parsed.collection.record;
    const fields = asArray(record.datafield);

    expect(xml).toContain('<collection xmlns="info:lc/xmlns/marcxchange-v2">');
    expect(record['@_format']).toBe('Unimarc');
    expect(record['@_type']).toBe('bibliographic');
    expect(record.leader).toHaveLength(24);
    expect(record.controlfield).toEqual({
      '@_tag': '001',
      '#text': canonicalExportEditionId,
    });

    const isbn = fieldsByTag(fields, '010');
    expect(isbn).toHaveLength(1);
    expect(values(isbn[0], 'a')).toEqual(['9789724426495']);

    const language = fieldsByTag(fields, '101');
    expect(language).toHaveLength(1);
    expect(language[0]['@_ind1']).toBe(' ');
    expect(language[0]['@_ind2']).toBe(' ');
    expect(values(language[0], 'a')).toEqual(['por', 'eng']);
    expect(values(language[0], 'c')).toEqual(['fra']);
    expect(values(language[0], 'j')).toEqual(['spa']);

    const title = fieldsByTag(fields, '200');
    expect(title).toHaveLength(1);
    expect(title[0]['@_ind1']).toBe('1');
    expect(title[0]['@_ind2']).toBe(' ');
    expect(values(title[0], 'a')).toEqual(['Canonical Edition Title']);
    expect(values(title[0], 'd')).toEqual(['Titre parallèle']);
    expect(values(title[0], 'e')).toEqual(['Canonical Subtitle']);
    expect(values(title[0], 'f')).toEqual(['por Ana Silva']);
    expect(values(title[0], 'g')).toEqual(['tradução de Jo Lee']);
    expect(
      fieldsByTag(fields, '517').map((field) => values(field, 'a')),
    ).toEqual([['Alternate Edition Title']]);

    const editionStatement = fieldsByTag(fields, '205');
    expect(editionStatement).toHaveLength(1);
    expect(editionStatement[0]['@_ind1']).toBe(' ');
    expect(editionStatement[0]['@_ind2']).toBe(' ');
    expect(values(editionStatement[0], 'a')).toEqual(['2.ª edição']);
    expect(values(editionStatement[0], 'b')).toEqual(['revista']);
    expect(values(editionStatement[0], 'f')).toEqual([
      'com notas de Ana Silva',
    ]);

    const publication = fieldsByTag(fields, '210');
    expect(publication).toHaveLength(2);
    expect(
      publication.map((field) => [field['@_ind1'], field['@_ind2']]),
    ).toEqual([
      [' ', '9'],
      [' ', '9'],
    ]);
    expect(values(publication[0], 'a')).toEqual(['Lisboa']);
    expect(values(publication[0], 'c')).toEqual(['Editora Canónica']);
    expect(values(publication[0], 'd')).toEqual(['2024']);
    expect(values(publication[1], 'e')).toEqual(['Porto']);
    expect(values(publication[1], 'f')).toEqual(['Imprensa Canónica']);
    expect(xml.indexOf('Lisboa')).toBeLessThan(xml.indexOf('Porto'));

    const physical = fieldsByTag(fields, '215');
    expect(physical).toHaveLength(1);
    expect(values(physical[0], 'a')).toEqual(['146, [6] p.']);
    expect(values(physical[0], 'b')).toEqual(['il.']);
    expect(values(physical[0], 'd')).toEqual(['24 cm']);

    const series = fieldsByTag(fields, '225');
    expect(series).toHaveLength(1);
    expect(values(series[0], 'a')).toEqual(['Colecção Folio']);
    expect(values(series[0], 'e')).toEqual(['Folio series']);
    expect(values(series[0], 'v')).toEqual(['12']);
    expect(values(series[0], 'x')).toEqual(['1234-5679']);

    for (const [tag, value] of [
      ['300', 'Canonical general note'],
      ['320', 'Bibliography note'],
      ['327', 'Contents note'],
      ['328', 'Dissertation note'],
      ['330', 'Summary note'],
      ['675', '821.134.3'],
    ]) {
      const matching = fieldsByTag(fields, tag);
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.some((field) => values(field, 'a').includes(value))).toBe(
        true,
      );
    }

    for (const [tag, name, ind1, ind2] of [
      ['700', 'Silva, Ana', '1', ' '],
      ['701', 'Costa, Rui', '1', ' '],
      ['702', 'Lee, Jo', '0', ' '],
      ['710', 'Associação Folio', '2', ' '],
      ['711', 'Fundação Exemplo', '2', ' '],
      ['712', 'Instituto Canónico', '2', ' '],
      ['713', 'Consórcio Canónico', '2', ' '],
    ]) {
      const matching = fieldsByTag(fields, tag);
      expect(matching).toHaveLength(1);
      expect(matching[0]['@_ind1']).toBe(ind1);
      expect(matching[0]['@_ind2']).toBe(ind2);
      expect(values(matching[0], 'a')).toEqual([name]);
    }
    expect(fields.findIndex(({ '@_tag': tag }) => tag === '700')).toBeLessThan(
      fields.findIndex(({ '@_tag': tag }) => tag === '710'),
    );

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
      'RAW PROVIDER CONTENT MUST NOT EXPORT',
      'UNMAPPED SHELF VALUE MUST NOT EXPORT',
      'ITEM PROVENANCE MUST NOT EXPORT',
    ]) {
      expect(xml).not.toContain(forbidden);
    }
    expect(xml).not.toContain('<warning');
    expect(xml).not.toContain('<diagnostic');
  }, 30_000);

  it('uses legacy scalar fallback only when canonical relation lists are empty', async () => {
    const token = await accessToken('export-member@example.test');
    const response = await request(app.getHttpServer())
      .get(`/exports/marcxchange/edition/${legacyFallbackEditionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const parsed = parser.parse(response.text as string) as {
      collection: { record: { datafield: ParsedField[] | ParsedField } };
    };
    const fields = asArray(parsed.collection.record.datafield);

    expect(values(fieldsByTag(fields, '010')[0], 'a')).toEqual(['0306406152']);
    expect(values(fieldsByTag(fields, '101')[0], 'a')).toEqual(['por']);
    expect(values(fieldsByTag(fields, '200')[0], 'a')).toEqual([
      'Legacy fallback title',
    ]);
    expect(values(fieldsByTag(fields, '200')[0], 'e')).toEqual([
      'Legacy fallback subtitle',
    ]);
    expect(values(fieldsByTag(fields, '210')[0], 'a')).toEqual(['Coimbra']);
    expect(values(fieldsByTag(fields, '210')[0], 'c')).toEqual([
      'Legacy fallback publisher',
    ]);
    expect(values(fieldsByTag(fields, '210')[0], 'd')).toEqual(['2001']);
    expect(values(fieldsByTag(fields, '215')[0], 'a')).toEqual(['100 p.']);
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

  it('exports only the requested Edition even for a user with memberships in both organizations', async () => {
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
});
