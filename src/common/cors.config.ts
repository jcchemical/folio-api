import type { INestApplication } from '@nestjs/common';

export function getCorsOptions(environment: NodeJS.ProcessEnv = process.env) {
  const configuredOrigins = environment.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isDevelopment =
    (environment.NODE_ENV || 'production') === 'development';

  return {
    origin: configuredOrigins?.length
      ? configuredOrigins
      : isDevelopment
        ? ['http://localhost:4200']
        : ['https://app.fol.io'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'If-None-Match',
      'X-Folio-Organization-Id',
    ],
    exposedHeaders: ['ETag'],
    credentials: true,
    maxAge: 3600,
  };
}

export function configureCors(
  app: Pick<INestApplication, 'enableCors'>,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  app.enableCors(getCorsOptions(environment));
}
