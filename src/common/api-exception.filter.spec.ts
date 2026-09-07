import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';

function response() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

describe('ApiExceptionFilter', () => {
  it('maps invalid credentials to a stable code', () => {
    const output = response();
    new ApiExceptionFilter().catch(
      new UnauthorizedException('Invalid email or password'),
      { switchToHttp: () => ({ getResponse: () => output, getRequest: () => ({}) }) } as never,
    );
    expect(output.statusCode).toBe(401);
    expect(output.body).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('maps validation arrays to safe validation details', () => {
    const output = response();
    new ApiExceptionFilter().catch(
      new BadRequestException(['email must be an email']),
      { switchToHttp: () => ({ getResponse: () => output, getRequest: () => ({}) }) } as never,
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
      new ConflictException('An edition with this ISBN already exists for this organization'),
      { switchToHttp: () => ({ getResponse: () => output, getRequest: () => ({}) }) } as never,
    );
    expect(output.body).toMatchObject({ code: 'CONFLICT_DUPLICATE_EDITION' });
  });
});
