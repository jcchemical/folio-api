import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { ApiExceptionFilter } from './../src/common/api-exception.filter.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('returns a stable code for invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password: 'wrong-password' })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
        expect(body.message).toBeDefined();
      });
  });

  it('throttles login after ten requests and returns rate-limit headers', async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'missing@example.com', password: 'wrong-password' })
        .expect(401);

      if (index === 0) {
        expect(response.headers['x-ratelimit-limit']).toBe('10');
        expect(response.headers['x-ratelimit-remaining']).toBe('9');
        expect(response.headers['x-ratelimit-reset']).toBeDefined();
      }
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.com', password: 'wrong-password' })
      .expect(429)
      .expect(({ headers }) => {
        expect(headers['retry-after']).toBeDefined();
      });
  });

  it('throttles signup after ten requests', async () => {
    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer()).post('/users').send({}).expect(400);
    }

    await request(app.getHttpServer()).post('/users').send({}).expect(429);
  });

  it('throttles catalogue preview after five requests', async () => {
    for (let index = 0; index < 5; index += 1) {
      await request(app.getHttpServer())
        .post('/catalogues/search')
        .send({})
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/catalogues/search')
      .send({})
      .expect(429);
  });

  it('throttles catalogue imports after five requests', async () => {
    for (let index = 0; index < 5; index += 1) {
      await request(app.getHttpServer())
        .post('/catalogues/import')
        .send({})
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/catalogues/import')
      .send({})
      .expect(429);
  });

  it.each(['/works', '/editions', '/items'])(
    'allows 100 requests to %s and throttles the 101st',
    async (path) => {
      for (let index = 0; index < 100; index += 1) {
        await request(app.getHttpServer()).get(path).expect(401);
      }

      await request(app.getHttpServer()).get(path).expect(429);
    },
  );

  it('returns AUTH_INVALID_ACCESS_TOKEN for an unauthenticated JWT-protected route', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTH_INVALID_ACCESS_TOKEN');
      });
  });

  it('exposes BibliographicRecord only as a read-only resource by id', async () => {
    await request(app.getHttpServer())
      .get('/bibliographic-records/record-1')
      .expect(401);

    await request(app.getHttpServer())
      .get('/bibliographic-records')
      .expect(404);
    await request(app.getHttpServer())
      .post('/bibliographic-records')
      .send({ format: 'MARC_TEXT', rawContent: '<record />' })
      .expect(404);
    await request(app.getHttpServer())
      .put('/bibliographic-records/record-1')
      .send({ rawContent: '<modified />' })
      .expect(404);
    await request(app.getHttpServer())
      .patch('/bibliographic-records/record-1')
      .send({ editionId: 'another-edition' })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/bibliographic-records/record-1')
      .expect(404);
  });

  it('returns a stable validation code without exposing internals', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_INVALID_BODY');
        expect(body.details.messages).toEqual(expect.any(Array));
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
