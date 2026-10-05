import { createId } from '@paralleldrive/cuid2';
import { Readable } from 'node:stream';
import type { StoredFile, StorageService } from './storage.service.js';
import { assertSafeOrganizationId, parseStorageKey } from './storage-key.js';

/** Volatile storage adapter intended for tests only. */
export class InMemoryStorage implements StorageService {
  readonly files = new Map<string, Buffer>();

  async save(
    organizationId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFile> {
    assertSafeOrganizationId(organizationId);
    const storageKey = `${organizationId}/${createId()}`;
    this.files.set(storageKey, Buffer.from(buffer));
    return { storageKey, mimeType, sizeBytes: buffer.byteLength };
  }

  async get(storageKey: string): Promise<Readable> {
    parseStorageKey(storageKey);
    const buffer = this.files.get(storageKey);
    if (!buffer) throw new Error(`Stored file not found: ${storageKey}`);
    return Readable.from([Buffer.from(buffer)]);
  }

  async delete(storageKey: string): Promise<void> {
    parseStorageKey(storageKey);
    this.files.delete(storageKey);
  }

  async exists(storageKey: string): Promise<boolean> {
    parseStorageKey(storageKey);
    return this.files.has(storageKey);
  }
}
