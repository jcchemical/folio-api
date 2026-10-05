import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import {
  JWT_CONFIGURATION,
  JWT_SECRET_MIN_LENGTH,
  resolveJwtConfiguration,
  type JwtConfiguration,
} from './jwt.configuration.js';
import { JwtStrategy } from './jwt.strategy.js';

const validTestSecret = 'integration-test-jwt-secret-only-2026';

describe('JWT configuration', () => {
  it('accepts an explicit secret meeting the minimum length', () => {
    const configuration = resolveJwtConfiguration({
      NODE_ENV: 'production',
      JWT_SECRET: validTestSecret,
    });

    expect(configuration.secret).toBe(validTestSecret);
    expect(
      Buffer.byteLength(configuration.secret, 'utf8'),
    ).toBeGreaterThanOrEqual(JWT_SECRET_MIN_LENGTH);
  });

  it('rejects a missing production secret without exposing secret material', () => {
    expect(() =>
      resolveJwtConfiguration({
        NODE_ENV: 'production',
        JWT_SECRET: undefined,
      }),
    ).toThrow('JWT_SECRET must be configured before starting the API.');
  });

  it('rejects a short secret in production without echoing it in the error', () => {
    const shortSecret = 'short-test-secret';
    let thrown: unknown;

    try {
      resolveJwtConfiguration({
        NODE_ENV: 'production',
        JWT_SECRET: shortSecret,
      });
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(
      `at least ${JWT_SECRET_MIN_LENGTH} bytes`,
    );
    expect((thrown as Error).message).not.toContain(shortSecret);
  });

  it('requires explicit configuration in development and isolates the test-only secret to test', () => {
    expect(() =>
      resolveJwtConfiguration({
        NODE_ENV: 'development',
        JWT_SECRET: undefined,
      }),
    ).toThrow('JWT_SECRET must be configured before starting the API.');

    const testConfiguration = resolveJwtConfiguration({
      NODE_ENV: 'test',
      JWT_SECRET: undefined,
    });
    expect(testConfiguration.secret).toContain('vitest-only');
    expect(testConfiguration.secret).not.toBe(validTestSecret);
  });

  it('shares one injected configuration between JwtModule signing and JwtStrategy verification', async () => {
    const configuration: JwtConfiguration = Object.freeze({
      secret: validTestSecret,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(JWT_CONFIGURATION)
      .useValue(configuration)
      .overrideProvider(AuthService)
      .useValue({ validateUser: vi.fn() })
      .compile();

    try {
      const jwtService = moduleRef.get(JwtService);
      const strategy = moduleRef.get(JwtStrategy);
      const token = await jwtService.signAsync({
        sub: 'test-user',
        email: 'test@example.test',
      });
      const verified = await jwtService.verifyAsync(token, {
        secret: configuration.secret,
      });

      expect(verified).toEqual({
        sub: 'test-user',
        email: 'test@example.test',
        iat: expect.any(Number),
        exp: expect.any(Number),
      });
      expect(Reflect.get(strategy, 'jwtConfiguration')).toBe(configuration);
    } finally {
      await moduleRef.close();
    }
  });
});
