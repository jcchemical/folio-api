import { Prisma } from '@prisma/client';

export type SafeErrorDiagnostics = {
  name?: string;
  message?: string;
  stack?: string;
  prismaCode?: string;
};

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'cookies',
  'database_url',
  'secret',
  'clientsecret',
]);

// Normalizes any thrown value into a small, serialization-safe shape for logs/diagnostics.
export function toSafeErrorDiagnostics(
  exception: unknown,
): SafeErrorDiagnostics {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: exception.name,
      message: exception.message,
      stack: exception.stack,
      prismaCode: exception.code,
    };
  }

  if (exception instanceof Error) {
    return {
      name: exception.name,
      message: exception.message,
      stack: exception.stack,
    };
  }

  if (typeof exception === 'string') {
    return { message: exception };
  }

  if (typeof exception === 'number' || typeof exception === 'boolean') {
    return { message: String(exception) };
  }

  return { message: 'A non-Error value was thrown.' };
}

// Removes secrets from a request-like object before it is ever logged.
export function sanitizeRequestContext(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!value) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    sanitized[key] =
      entry !== null && typeof entry === 'object' && !Array.isArray(entry)
        ? sanitizeRequestContext(entry as Record<string, unknown>)
        : entry;
  }
  return sanitized;
}
