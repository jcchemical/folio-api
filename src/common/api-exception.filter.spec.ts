import {
  BadRequestException,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';

function response() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function host(
  output: ReturnType<typeof response>,
  request: Record<string, unknown> = { method: 'POST', originalUrl: '/things' },
) {
  return {
    switchToHttp: () => ({
      getResponse: () => output,
      getRequest: () => request,
    }),
  } as never;
}

describe('ApiExceptionFilter', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('maps invalid credentials to a stable code', () => {
    const output = response();
    new ApiExceptionFilter().catch(
      new UnauthorizedException('Invalid email or password'),
      host(output),
    );
    expect(output.statusCode).toBe(401);
    expect(output.body).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('maps validation arrays to safe validation details', () => {
    const output = response();
    new ApiExceptionFilter().catch(
      new BadRequestException(['email must be an email']),
      host(output),
    );
    expect(output.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_INVALID_BODY',
      message: 'Request validation failed.',
      details: { messages: ['email must be an email'] },
    });
  });

  it('maps duplicate editions without coupling clients to the message', () => {
    const output = response();
    new ApiExceptionFilter().catch(
      new ConflictException(
        'An edition with this ISBN already exists for this organization',
      ),
      host(output),
    );
    expect(output.body).toMatchObject({ code: 'CONFLICT_DUPLICATE_EDITION' });
  });

  it('returns the sanitized 500 envelope in production for an unknown error, with no debug field', () => {
    const output = response();
    new ApiExceptionFilter({
      nodeEnv: 'production',
      includeDebugDetails: false,
    }).catch(
      new Error('leaked internal detail: SELECT * FROM "User"'),
      host(output),
    );
    expect(output.statusCode).toBe(500);
    expect(output.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(output.body).not.toHaveProperty('debug');
  });

  it('returns the sanitized 500 envelope in development when diagnostics are disabled', () => {
    const output = response();
    new ApiExceptionFilter({
      nodeEnv: 'development',
      includeDebugDetails: false,
    }).catch(new Error('internal detail'), host(output));
    expect(output.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(output.body).not.toHaveProperty('debug');
  });

  it('includes only safe debug fields in development when diagnostics are enabled', () => {
    const output = response();
    new ApiExceptionFilter({
      nodeEnv: 'development',
      includeDebugDetails: true,
    }).catch(new Error('internal detail'), host(output));
    expect(output.body).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(
      (
        output.body as {
          debug: { name?: string; message?: string; stack?: string };
        }
      ).debug,
    ).toMatchObject({
      name: 'Error',
      message: 'internal detail',
    });
    expect(
      (output.body as { debug: { stack?: string } }).debug.stack,
    ).toContain('Error: internal detail');
  });

  it('never includes debug details in production even if the flag is accidentally true', () => {
    const output = response();
    new ApiExceptionFilter({
      nodeEnv: 'production',
      includeDebugDetails: true as never,
    }).catch(new Error('internal detail'), host(output));
    expect(output.body).not.toHaveProperty('debug');
  });

  it('does not crash and only serializes safe primitives for a non-Error throwable', () => {
    const output = response();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      new ApiExceptionFilter({
        nodeEnv: 'development',
        includeDebugDetails: true,
      }).catch(circular, host(output)),
    ).not.toThrow();
    expect(output.statusCode).toBe(500);
    expect((output.body as { debug: { message?: string } }).debug.message).toBe(
      'A non-Error value was thrown.',
    );
  });

  it('never leaks sensitive values from the request or exception into the response or logs', () => {
    const output = response();
    new ApiExceptionFilter({
      nodeEnv: 'development',
      includeDebugDetails: true,
    }).catch(
      new Error('failed for user'),
      host(output, {
        method: 'POST',
        originalUrl: '/auth/login',
        headers: { authorization: 'Bearer secret-token' },
        body: { password: 'super-secret', token: 'abc' },
      }),
    );

    const serializedResponse = JSON.stringify(output.body);
    expect(serializedResponse).not.toContain('super-secret');
    expect(serializedResponse).not.toContain('Bearer secret-token');

    const loggedText = errorSpy.mock.calls.flat().join(' ');
    expect(loggedText).not.toContain('super-secret');
    expect(loggedText).not.toContain('Bearer secret-token');
  });

  it('maps Prisma P2002, P2025 and P2003 to stable statuses and codes', () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError(
      'duplicate',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
      },
    );
    const notFound = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });
    const foreignKey = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: '7.10.0',
    });

    const uniqueOutput = response();
    new ApiExceptionFilter().catch(uniqueViolation, host(uniqueOutput));
    expect(uniqueOutput.statusCode).toBe(409);
    expect(uniqueOutput.body).toMatchObject({
      code: 'CONFLICT_DUPLICATE_RESOURCE',
    });

    const notFoundOutput = response();
    new ApiExceptionFilter().catch(notFound, host(notFoundOutput));
    expect(notFoundOutput.statusCode).toBe(404);
    expect(notFoundOutput.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    const foreignKeyOutput = response();
    new ApiExceptionFilter().catch(foreignKey, host(foreignKeyOutput));
    expect(foreignKeyOutput.statusCode).toBe(409);
    expect(foreignKeyOutput.body).toMatchObject({
      code: 'CONFLICT_FOREIGN_KEY_REFERENCE',
    });
  });

  it('does not expose raw Prisma meta in the response', () => {
    const output = response();
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError(
      'duplicate on User.email',
      {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['email'] },
      },
    );

    new ApiExceptionFilter().catch(uniqueViolation, host(output));

    expect(JSON.stringify(output.body)).not.toContain('target');
    expect(JSON.stringify(output.body)).not.toContain('email');
  });
});
