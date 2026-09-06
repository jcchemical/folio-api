import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  SwaggerModule,
  SwaggerCustomOptions,
} from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const isDevelopment = process.env.NODE_ENV !== 'production';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS para desenvolvimento (ajusta origins em produção)
 
    if (isDevelopment) {
    // Aceita qualquer localhost:porta em desenvolvimento
    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allowed?: boolean) => void) => {
        if (!origin) {
          // curl, Postman, etc.
          callback(null, true);
          return;
        }

        const allowed = /^http:\/\/localhost:\d+$/;
        if (allowed.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS não permitido para este origin'), false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
  } else {
    // Produção: lista explícita de origins confiáveis
    app.enableCors({
      origin: [
        'https://app.fol.io',
        // outros origins de produção
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
  }

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