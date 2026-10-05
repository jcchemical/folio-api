import { Global, Module } from '@nestjs/common';

export const JWT_CONFIGURATION = Symbol('JWT_CONFIGURATION');
export const JWT_SECRET_MIN_LENGTH = 32;

const TEST_ONLY_JWT_SECRET = 'vitest-only-secret-not-for-deployment-2026';

export type JwtConfiguration = Readonly<{ secret: string }>;
export type JwtEnvironment = {
  JWT_SECRET?: string;
  NODE_ENV?: string;
};

export function resolveJwtConfiguration(
  environment: JwtEnvironment = process.env,
): JwtConfiguration {
  const configuredSecret = environment.JWT_SECRET;
  if (configuredSecret === undefined || configuredSecret.trim().length === 0) {
    if (environment.NODE_ENV === 'test') {
      return Object.freeze({ secret: TEST_ONLY_JWT_SECRET });
    }
    throw new Error('JWT_SECRET must be configured before starting the API.');
  }

  if (Buffer.byteLength(configuredSecret, 'utf8') < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET must contain at least ${JWT_SECRET_MIN_LENGTH} bytes.`,
    );
  }

  return Object.freeze({ secret: configuredSecret });
}

@Global()
@Module({
  providers: [
    {
      provide: JWT_CONFIGURATION,
      useFactory: (): JwtConfiguration => resolveJwtConfiguration(),
    },
  ],
  exports: [JWT_CONFIGURATION],
})
export class JwtConfigurationModule {}
