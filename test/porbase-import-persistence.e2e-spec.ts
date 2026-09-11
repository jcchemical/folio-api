import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { hashPassword } from '../src/auth/password.utils.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';

// This suite exercises the real CatalogueService -> PorbaseCatalogueProvider
// -> PorbaseImportService chain end-to-end over HTTP, with only PrismaService
// faked (mirroring the transaction-mock pattern already used in
// porbase-import.service.spec.ts). Unlike test/porbase-import.e2e-spec.ts,
// PorbaseCatalogueProvider is NOT overridden here, so this proves the Phase 1
// canonical persistence actually runs through the HTTP layer.
describe('Catalogue import persistence (e2e)', () => {
  let app: INestApplication<App>;
  let tx: ReturnType<typeof createTransactionMock>['tx'];

  function createTransactionMock() {
    const work = { id: 'work-1' };
    const edition = { id: 'edition-1' };
    const t = {
      edition: {
        findFirst: async () => null,
        create: async () => edition,
      },
      work: {
        create: async () => work,
        findUniqueOrThrow: async () => ({
          id: work.id,
          title: 'Canonical work title',
          subtitle: null,
          organization: { id: 'organization-1', name: 'Personal' },
          titles: [
            {
              id: 'wt-1',
              type: 'MAIN',
              value: 'Canonical work title',
              subtitle: null,
              language: null,
              partNumber: null,
              partName: null,
              sortOrder: 0,
            },
          ],
          editions: [
            {
              ...edition,
              title: 'Canonical edition title',
              subtitle: null,
              isbn10: null,
              isbn13: '9789724426495',
              publisher: null,
              publicationDate: null,
              language: 'por',
              country: null,
              format: null,
              pageCount: null,
              externalIdentifiers: [],
              bibliographicRecords: [
                {
                  id: 'record-1',
                  format: 'MARC_TEXT',
                  source: 'PORBASE',
                  sourceId: 'porbase',
                  remoteId: 'record-1',
                  rawContent:
                    '200 $a Canonical edition title\n966 $l BN $s Shelf 1',
                  unmappedSourceFields: [
                    {
                      id: 'unmapped-1',
                      tag: '966',
                      indicator1: ' ',
                      indicator2: ' ',
                      occurrence: 0,
                      reason: 'LOCAL',
                      subfields: [
                        { id: 'sub-1', code: 'l', value: 'BN', sortOrder: 0 },
                        {
                          id: 'sub-2',
                          code: 's',
                          value: 'Shelf 1',
                          sortOrder: 1,
                        },
                      ],
                    },
                  ],
                },
              ],
              items: [
                {
                  id: 'item-1',
                  label: null,
                  location: null,
                  status: 'OWNED',
                  notes: null,
                  organizationId: 'organization-1',
                },
              ],
              titles: [
                {
                  id: 'et-1',
                  type: 'MAIN',
                  value: 'Canonical edition title',
                  subtitle: null,
                  language: null,
                  partNumber: null,
                  partName: null,
                  sortOrder: 0,
                },
              ],
              responsibilityStatements: [],
              languages: [
                { id: 'el-1', code: 'por', role: 'TEXT', sortOrder: 0 },
              ],
              series: [],
              notes: [],
              classifications: [],
              physicalDescriptions: [],
              publicationStatements: [],
              editionContributors: [],
              contributions: [],
            },
          ],
          workContributors: [],
          contributions: [],
          bibliographicRecords: [],
        }),
      },
      contributor: {
        findMany: async () => [],
        create: async () => ({ id: 'contributor-1', name: 'Author Name' }),
      },
      workContributor: { create: async () => ({}) },
      editionContributor: { create: async () => ({}) },
      externalIdentifier: { create: async () => ({}) },
      bibliographicRecord: {
        create: async () => ({
          id: 'record-1',
          format: 'MARC_TEXT',
          source: 'PORBASE',
          sourceId: 'porbase',
          remoteId: 'record-1',
          rawContent: '200 $a Canonical edition title\n966 $l BN $s Shelf 1',
          unmappedSourceFields: [
            {
              id: 'unmapped-1',
              tag: '966',
              indicator1: ' ',
              indicator2: ' ',
              occurrence: 0,
              reason: 'LOCAL',
              subfields: [
                { id: 'sub-1', code: 'l', value: 'BN', sortOrder: 0 },
                { id: 'sub-2', code: 's', value: 'Shelf 1', sortOrder: 1 },
              ],
            },
          ],
        }),
      },
      item: {
        create: async () => ({
          id: 'item-1',
          label: null,
          location: null,
          status: 'OWNED',
          notes: null,
          organizationId: 'organization-1',
        }),
      },
    };
    return { tx: t };
  }

  beforeEach(async () => {
    const storedPasswordHash = await hashPassword('password');
    const user = {
      id: 'e2e-user',
      email: 'e2e-persist@example.com',
      name: 'E2E Persist User',
      passwordHash: storedPasswordHash,
      refreshToken: null,
      refreshTokenExpires: null,
    };
    const created = createTransactionMock();
    tx = created.tx;
    const prisma = {
      user: {
        findUnique: async () => user,
        update: async ({ data }: { data: Partial<typeof user> }) =>
          Object.assign(user, data),
      },
      organizationMembership: {
        findFirst: async () => ({
          organization: { id: 'organization-1', name: 'Personal' },
        }),
      },
      $transaction: async (callback: (t: typeof tx) => unknown) => callback(tx),
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('persists an enriched import and returns the canonical aggregate, with authoritative provenance', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-persist@example.com', password: 'password' })
      .expect(201);
    const token = login.body.accessToken as string;

    const response = await request(app.getHttpServer())
      .post('/catalogues/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        work: {
          title: 'Legacy work title',
          titles: [
            { type: 'MAIN', value: 'Canonical work title', sortOrder: 0 },
          ],
        },
        edition: {
          title: 'Legacy edition title',
          isbn13: '9789724426495',
          language: 'eng',
          titles: [
            { type: 'MAIN', value: 'Canonical edition title', sortOrder: 0 },
          ],
          languages: [{ code: 'por', role: 'TEXT', sortOrder: 0 }],
        },
        contributors: [],
        externalIdentifiers: [
          { type: 'ISBN-13', value: '9789724426495', source: 'PORBASE' },
        ],
        bibliographicRecord: {
          format: 'MARC_TEXT',
          remoteId: 'record-1',
          rawContent: '200 $a Canonical edition title\n966 $l BN $s Shelf 1',
          // Forged provenance attempt; must never survive to persistence.
          source: 'FORGED',
          schema: 'FORGED',
          sourceId: 'forged-provider',
        },
        item: { status: 'OWNED' },
      })
      .expect(201);

    expect(response.body.sourceId).toBe('porbase');
    expect(response.body.work.title).toBe('Canonical work title');
    expect(response.body.edition.title).toBe('Canonical edition title');
    expect(response.body.edition.titles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MAIN',
          value: 'Canonical edition title',
        }),
      ]),
    );
    expect(response.body.edition.languages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'por', role: 'TEXT' }),
      ]),
    );
    expect(response.body.bibliographicRecord.source).toBe('PORBASE');
    expect(response.body.bibliographicRecord.sourceId).toBe('porbase');
    expect(response.body.bibliographicRecord.unmappedSourceFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tag: '966',
          reason: 'LOCAL',
          subfields: expect.arrayContaining([
            expect.objectContaining({ code: 'l', value: 'BN' }),
            expect.objectContaining({ code: 's', value: 'Shelf 1' }),
          ]),
        }),
      ]),
    );
  });
});
