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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
