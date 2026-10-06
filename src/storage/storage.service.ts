import type { Readable } from 'node:stream';

export interface StoredFile {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface StorageService {
  save(
    organizationId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFile>;
  get(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

export const STORAGE_SERVICE = Symbol('StorageService');

export function getConfiguredStorageBackend(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configuredBackend = environment.COVER_STORAGE_BACKEND;
  return configuredBackend
    ? configuredBackend.toLowerCase()
    : environment.NODE_ENV === 'test'
      ? 'in_memory'
      : 'local_fs';
}
