import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  SwaggerCustomOptions,
} from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS para desenvolvimento (ajusta origins em produção)
  app.enableCors({
    origin: [
      'http://localhost',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:56341',
      'http://127.0.0.1',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:56341',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Opções da UI do Swagger
  const swaggerOptions: SwaggerCustomOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Folio API Docs',
  };

  // Swagger UI em /docs
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, {
      info: {
        title: 'Folio API',
        description: 'API para gestão de biblioteca Folio',
        version: '0.1.0',
      },
      openapi: '3.1.0',
    }),
    swaggerOptions,
  );

await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();