import type { PoolConfig } from 'pg';

export const DEFAULT_DATABASE_POOL_MAX = 10;
export const DEFAULT_DATABASE_CONNECTION_TIMEOUT_MS = 5_000;
export const DEFAULT_DATABASE_IDLE_TIMEOUT_MS = 10_000;
export const DEFAULT_DATABASE_QUERY_TIMEOUT_MS = 10_000;
export const DEFAULT_APP_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_APP_HEADERS_TIMEOUT_MS = 20_000;
export const DEFAULT_APP_KEEP_ALIVE_TIMEOUT_MS = 5_000;

export function readPositiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = Number(environment[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getDatabasePoolOptions(
  environment: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  return {
    connectionString: environment.DATABASE_URL,
    max: readPositiveInteger(
      environment,
      'DATABASE_POOL_MAX',
      DEFAULT_DATABASE_POOL_MAX,
    ),
    connectionTimeoutMillis: readPositiveInteger(
      environment,
      'DATABASE_CONNECTION_TIMEOUT_MS',
      DEFAULT_DATABASE_CONNECTION_TIMEOUT_MS,
    ),
    idleTimeoutMillis: readPositiveInteger(
      environment,
      'DATABASE_IDLE_TIMEOUT_MS',
      DEFAULT_DATABASE_IDLE_TIMEOUT_MS,
    ),
    query_timeout: readPositiveInteger(
      environment,
      'DATABASE_QUERY_TIMEOUT_MS',
      DEFAULT_DATABASE_QUERY_TIMEOUT_MS,
    ),
  };
}

export function getHttpTimeouts(environment: NodeJS.ProcessEnv = process.env) {
  return {
    requestTimeout: readPositiveInteger(
      environment,
      'APP_REQUEST_TIMEOUT_MS',
      DEFAULT_APP_REQUEST_TIMEOUT_MS,
    ),
    headersTimeout: readPositiveInteger(
      environment,
      'APP_HEADERS_TIMEOUT_MS',
      DEFAULT_APP_HEADERS_TIMEOUT_MS,
    ),
    keepAliveTimeout: readPositiveInteger(
      environment,
      'APP_KEEP_ALIVE_TIMEOUT_MS',
      DEFAULT_APP_KEEP_ALIVE_TIMEOUT_MS,
    ),
  };
}
