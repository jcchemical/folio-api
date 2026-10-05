import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard stable access-token error', () => {
  it('returns AUTH_INVALID_ACCESS_TOKEN when Passport finds no user', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(null, false)).toThrowError(
      expect.objectContaining({
        status: 401,
        response: expect.objectContaining({
          code: 'AUTH_INVALID_ACCESS_TOKEN',
        }),
      }),
    );
  });

  it('does not expose Passport token verification details', () => {
    const guard = new JwtAuthGuard();
    const sensitiveError = new Error('verification failed for secret-token');

    try {
      guard.handleRequest(sensitiveError, false);
      throw new Error('Expected the guard to reject the request');
    } catch (error: unknown) {
      expect(error).toMatchObject({
        status: 401,
        response: {
          code: 'AUTH_INVALID_ACCESS_TOKEN',
          message: 'A valid access token is required.',
        },
      });
      expect(
        JSON.stringify((error as { response: unknown }).response),
      ).not.toContain('secret-token');
    }
  });
});
