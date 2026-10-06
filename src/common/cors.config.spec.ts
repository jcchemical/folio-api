import { describe, expect, it } from 'vitest';
import { getCorsOptions } from './cors.config.js';

describe('CORS configuration', () => {
  it('parses and trims comma-separated origins from the environment', () => {
    expect(
      getCorsOptions({
        NODE_ENV: 'development',
        CORS_ORIGIN: ' http://localhost:4200, https://folio.test ',
      }).origin,
    ).toEqual(['http://localhost:4200', 'https://folio.test']);
  });

  it('uses the production origin when NODE_ENV is missing', () => {
    expect(getCorsOptions({}).origin).toEqual(['https://app.fol.io']);
  });

  it('uses localhost only when running development without CORS_ORIGIN', () => {
    expect(getCorsOptions({ NODE_ENV: 'development' }).origin).toEqual([
      'http://localhost:4200',
    ]);
  });

  it('allows conditional requests and exposes ETag', () => {
    expect(getCorsOptions({}).allowedHeaders).toContain('If-None-Match');
    expect(getCorsOptions({}).exposedHeaders).toContain('ETag');
    expect(getCorsOptions({})).toMatchObject({
      credentials: true,
      maxAge: 3600,
    });
  });
});
