import { describe, expect, it } from 'vitest';
import { getErrorHandlingConfig } from './error-handling.config.js';

describe('getErrorHandlingConfig', () => {
  it('defaults to production with diagnostics disabled when NODE_ENV is unset', () => {
    expect(getErrorHandlingConfig({})).toEqual({
      nodeEnv: 'production',
      includeDebugDetails: false,
    });
  });

  it('treats any unrecognized NODE_ENV as production', () => {
    expect(getErrorHandlingConfig({ NODE_ENV: 'staging' })).toEqual({
      nodeEnv: 'production',
      includeDebugDetails: false,
    });
  });

  it('enables diagnostics only in development with the exact opt-in flag', () => {
    expect(
      getErrorHandlingConfig({
        NODE_ENV: 'development',
        ERROR_DETAILS_IN_RESPONSE: 'true',
      }),
    ).toEqual({ nodeEnv: 'development', includeDebugDetails: true });
  });

  it('keeps diagnostics disabled in development when the flag is missing or malformed', () => {
    expect(getErrorHandlingConfig({ NODE_ENV: 'development' })).toEqual({
      nodeEnv: 'development',
      includeDebugDetails: false,
    });
    expect(
      getErrorHandlingConfig({
        NODE_ENV: 'development',
        ERROR_DETAILS_IN_RESPONSE: 'TRUE',
      }),
    ).toEqual({ nodeEnv: 'development', includeDebugDetails: false });
    expect(
      getErrorHandlingConfig({
        NODE_ENV: 'development',
        ERROR_DETAILS_IN_RESPONSE: '1',
      }),
    ).toEqual({ nodeEnv: 'development', includeDebugDetails: false });
  });

  it('never enables diagnostics in production even if the flag is true', () => {
    expect(
      getErrorHandlingConfig({
        NODE_ENV: 'production',
        ERROR_DETAILS_IN_RESPONSE: 'true',
      }),
    ).toEqual({ nodeEnv: 'production', includeDebugDetails: false });
  });

  it('keeps diagnostics disabled in test even if the flag is true', () => {
    expect(
      getErrorHandlingConfig({
        NODE_ENV: 'test',
        ERROR_DETAILS_IN_RESPONSE: 'true',
      }),
    ).toEqual({ nodeEnv: 'test', includeDebugDetails: false });
  });
});
