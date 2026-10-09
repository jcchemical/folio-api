import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { WorksController } from '../works/works.controller.js';
import { WorksService } from '../works/works.service.js';
import { EditionCoverService } from './edition-cover.service.js';
import { EditionsController } from './editions.controller.js';
import { EditionsService } from './editions.service.js';

const physicalDescriptions = [
  {
    sortOrder: 0,
    parts: [
      { subfield: 'a', value: '245 páginas', sortOrder: 0 },
      { subfield: 'd', value: '21 cm', sortOrder: 1 },
    ],
  },
];

describe('Physical Description route validation', () => {
  let app: INestApplication<App>;
  const editionsService = {
    create: vi.fn().mockResolvedValue({ id: 'edition-1' }),
    update: vi.fn().mockResolvedValue({ id: 'edition-1' }),
  };
  const worksService = {
    create: vi.fn().mockResolvedValue({ id: 'work-1' }),
  };

  beforeAll(async () => {
    const authenticatedGuard: CanActivate = {
      canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().user = { id: 'user-1' };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [EditionsController, WorksController],
      providers: [
        { provide: EditionsService, useValue: editionsService },
        { provide: WorksService, useValue: worksService },
        { provide: EditionCoverService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authenticatedGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts Physical Descriptions on POST /editions', async () => {
    await request(app.getHttpServer())
      .post('/editions')
      .send({
        workId: 'work-1',
        title: 'Edition',
        physicalDescriptions,
      })
      .expect(201);

    expect(editionsService.create).toHaveBeenCalledWith(
      'user-1',
      'work-1',
      {
        title: 'Edition',
        physicalDescriptions,
      },
      undefined,
    );
  });

  it('accepts Physical Descriptions on PUT /editions/:id', async () => {
    await request(app.getHttpServer())
      .put('/editions/edition-1')
      .send({ physicalDescriptions })
      .expect(200);

    expect(editionsService.update).toHaveBeenCalledWith(
      'edition-1',
      'user-1',
      { physicalDescriptions },
      undefined,
    );
  });

  it('accepts Physical Descriptions on nested Editions in POST /works', async () => {
    await request(app.getHttpServer())
      .post('/works')
      .set('X-Folio-Organization-Id', `c${'a'.repeat(24)}`)
      .send({
        title: 'Work',
        editions: [{ title: 'Edition', physicalDescriptions }],
      })
      .expect(201);

    expect(worksService.create).toHaveBeenCalledWith(
      'user-1',
      `c${'a'.repeat(24)}`,
      {
        title: 'Work',
        editions: [{ title: 'Edition', physicalDescriptions }],
      },
    );
  });

  it('rejects a non-array Physical Description before calling a service', async () => {
    await request(app.getHttpServer())
      .post('/editions')
      .send({
        workId: 'work-1',
        title: 'Edition',
        physicalDescriptions: physicalDescriptions[0],
      })
      .expect(400);

    expect(editionsService.create).not.toHaveBeenCalled();
  });
});
