import { Module } from '@nestjs/common';
import { InMemoryStorage } from './in-memory.storage.js';
import {
  DEFAULT_COVER_STORAGE_ROOT,
  LocalFsStorage,
} from './local-fs.storage.js';
import { STORAGE_SERVICE, type StorageService } from './storage.service.js';

export type CoverStorageBackend = 'in_memory' | 'local_fs' | 's3';

export function createStorageService(
  environment: NodeJS.ProcessEnv = process.env,
): StorageService {
  const configuredBackend = environment.COVER_STORAGE_BACKEND;
  const backend: CoverStorageBackend = configuredBackend
    ? (configuredBackend.toLowerCase() as CoverStorageBackend)
    : environment.NODE_ENV === 'test'
      ? 'in_memory'
      : 'local_fs';

  switch (backend) {
    case 'in_memory':
      if (environment.NODE_ENV !== 'test') {
        throw new Error(
          'COVER_STORAGE_BACKEND=in_memory is only available in tests',
        );
      }
      return new InMemoryStorage();
    case 'local_fs':
      return new LocalFsStorage(
        environment.COVER_STORAGE_ROOT ?? DEFAULT_COVER_STORAGE_ROOT,
      );
    case 's3':
      throw new Error(
        'COVER_STORAGE_BACKEND=s3 is not available yet; S3Storage is planned but not implemented',
      );
    default:
      throw new Error(
        `Unsupported COVER_STORAGE_BACKEND: ${configuredBackend}`,
      );
  }
}

@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: () => createStorageService(),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
