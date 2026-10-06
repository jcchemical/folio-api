import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, SwaggerCustomOptions } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { getHttpTimeouts } from './prisma/runtime.config.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { configureCors } from './common/cors.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const server = app.getHttpServer();
  Object.assign(server, getHttpTimeouts());

  configureCors(app);

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

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
