import { describe, expect, it } from 'vitest';
import {
  getDatabasePoolOptions,
  getHttpTimeouts,
  readPositiveInteger,
} from './runtime.config.js';

describe('runtime database and HTTP configuration', () => {
  it('uses bounded defaults for pool and timeouts', () => {
    expect(getDatabasePoolOptions({})).toMatchObject({
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      query_timeout: 10_000,
    });
    expect(getHttpTimeouts({})).toEqual({
      requestTimeout: 15_000,
      headersTimeout: 20_000,
      keepAliveTimeout: 5_000,
    });
  });

  it('respects positive environment overrides', () => {
    const environment = {
      DATABASE_POOL_MAX: '20',
      DATABASE_CONNECTION_TIMEOUT_MS: '2000',
      DATABASE_IDLE_TIMEOUT_MS: '3000',
      DATABASE_QUERY_TIMEOUT_MS: '4000',
      APP_REQUEST_TIMEOUT_MS: '6000',
      APP_HEADERS_TIMEOUT_MS: '7000',
      APP_KEEP_ALIVE_TIMEOUT_MS: '8000',
    };

    expect(getDatabasePoolOptions(environment)).toMatchObject({
      max: 20,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 3_000,
      query_timeout: 4_000,
    });
    expect(getHttpTimeouts(environment)).toEqual({
      requestTimeout: 6_000,
      headersTimeout: 7_000,
      keepAliveTimeout: 8_000,
    });
  });

  it('falls back when values are zero, negative, fractional or invalid', () => {
    const environment = {
      DATABASE_POOL_MAX: '0',
      DATABASE_QUERY_TIMEOUT_MS: '-1',
      APP_REQUEST_TIMEOUT_MS: '1.5',
    };

    expect(readPositiveInteger(environment, 'DATABASE_POOL_MAX', 10)).toBe(10);
    expect(readPositiveInteger(environment, 'DATABASE_QUERY_TIMEOUT_MS', 10_000)).toBe(10_000);
    expect(readPositiveInteger(environment, 'APP_REQUEST_TIMEOUT_MS', 15_000)).toBe(15_000);
  });
});
