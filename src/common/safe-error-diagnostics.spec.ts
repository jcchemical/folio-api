import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  sanitizeRequestContext,
  toSafeErrorDiagnostics,
} from './safe-error-diagnostics.js';

describe('toSafeErrorDiagnostics', () => {
  it('extracts safe fields from a plain Error', () => {
    const error = new Error('boom');
    const diagnostics = toSafeErrorDiagnostics(error);
    expect(diagnostics.name).toBe('Error');
    expect(diagnostics.message).toBe('boom');
    expect(diagnostics.stack).toContain('Error: boom');
    expect(diagnostics.prismaCode).toBeUndefined();
  });

  it('includes the Prisma error code for known Prisma errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });
    const diagnostics = toSafeErrorDiagnostics(error);
    expect(diagnostics.prismaCode).toBe('P2002');
    expect(diagnostics.name).toBe('PrismaClientKnownRequestError');
  });

  it('does not crash and produces only safe primitives for non-Error throwables', () => {
    expect(toSafeErrorDiagnostics('a raw string')).toEqual({
      message: 'a raw string',
    });
    expect(toSafeErrorDiagnostics(42)).toEqual({ message: '42' });
    expect(toSafeErrorDiagnostics(null)).toEqual({
      message: 'A non-Error value was thrown.',
    });

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => toSafeErrorDiagnostics(circular)).not.toThrow();
    expect(toSafeErrorDiagnostics(circular)).toEqual({
      message: 'A non-Error value was thrown.',
    });
  });
});

describe('sanitizeRequestContext', () => {
  it('redacts known sensitive keys, including nested ones', () => {
    const sanitized = sanitizeRequestContext({
      email: 'user@fol.io',
      password: 'super-secret',
      authorization: 'Bearer abc.def.ghi',
      nested: { refreshToken: 'refresh-value', ok: true },
    });

    expect(sanitized).toEqual({
      email: 'user@fol.io',
      password: '[REDACTED]',
      authorization: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', ok: true },
    });
  });

  it('returns an empty object when no context is provided', () => {
    expect(sanitizeRequestContext(undefined)).toEqual({});
  });
});
