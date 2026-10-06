import { readPositiveInteger } from '../prisma/runtime.config.js';

export const DEFAULT_THROTTLE_TTL_MS = 60_000;
export const DEFAULT_THROTTLE_LIMIT = 10;

export const THROTTLE_TTL_MS = readPositiveInteger(
  process.env,
  'THROTTLE_TTL',
  DEFAULT_THROTTLE_TTL_MS,
);
export const THROTTLE_LIMIT = readPositiveInteger(
  process.env,
  'THROTTLE_LIMIT',
  DEFAULT_THROTTLE_LIMIT,
);
