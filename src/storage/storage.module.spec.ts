import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from './in-memory.storage.js';
import { LocalFsStorage } from './local-fs.storage.js';
import { createStorageService } from './storage.module.js';

describe('StorageModule backend configuration', () => {
  it('defaults to in-memory storage in tests', () => {
    expect(createStorageService({ NODE_ENV: 'test' })).toBeInstanceOf(
      InMemoryStorage,
    );
  });

  it('prevents in-memory storage from being configured outside tests', () => {
    expect(() =>
      createStorageService({
        NODE_ENV: 'development',
        COVER_STORAGE_BACKEND: 'in_memory',
      }),
    ).toThrow('only available in tests');
  });

  it('defaults to local filesystem outside tests and respects the configured root', () => {
    expect(createStorageService({ NODE_ENV: 'development' })).toBeInstanceOf(
      LocalFsStorage,
    );
    expect(
      createStorageService({
        NODE_ENV: 'test',
        COVER_STORAGE_BACKEND: 'local_fs',
        COVER_STORAGE_ROOT: '/tmp/custom-covers',
      }),
    ).toBeInstanceOf(LocalFsStorage);
  });

  it('fails fast for S3 until its adapter is implemented', () => {
    expect(() => createStorageService({ COVER_STORAGE_BACKEND: 's3' })).toThrow(
      'S3Storage is planned but not implemented',
    );
  });

  it('rejects unknown backend names', () => {
    expect(() =>
      createStorageService({ COVER_STORAGE_BACKEND: 'remote' }),
    ).toThrow('Unsupported COVER_STORAGE_BACKEND');
  });
});
