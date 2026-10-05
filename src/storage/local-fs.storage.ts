import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { constants } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createId } from '@paralleldrive/cuid2';
import type { Readable } from 'node:stream';
import type { StoredFile, StorageService } from './storage.service.js';
import { assertSafeOrganizationId, parseStorageKey } from './storage-key.js';

export const DEFAULT_COVER_STORAGE_ROOT = './storage/covers';

export class LocalFsStorage implements StorageService {
  private readonly rootPath: string;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(
    rootPath = process.env.COVER_STORAGE_ROOT ?? DEFAULT_COVER_STORAGE_ROOT,
  ) {
    this.rootPath = resolve(rootPath);
  }

  save(
    organizationId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFile> {
    // Serialize local writes so simultaneous saves through this adapter share
    // the same organization-scoped content-hash deduplication check.
    const operation = this.saveQueue.then(() =>
      this.saveFile(organizationId, buffer, mimeType),
    );
    this.saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async get(storageKey: string): Promise<Readable> {
    return createReadStream(this.resolveStoragePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolveStoragePath(storageKey), { force: true });
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await access(this.resolveStoragePath(storageKey), constants.F_OK);
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  private async saveFile(
    organizationId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFile> {
    assertSafeOrganizationId(organizationId);
    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const organizationPath = join(this.rootPath, organizationId);

    const existingKey = await this.findByContentHash(
      organizationId,
      organizationPath,
      contentHash,
    );
    if (existingKey) {
      return {
        storageKey: existingKey,
        mimeType,
        sizeBytes: buffer.byteLength,
      };
    }

    await mkdir(organizationPath, { recursive: true });
    const storageKey = `${organizationId}/${createId()}`;
    const filePath = this.resolveStoragePath(storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer, { flag: 'wx' });

    return { storageKey, mimeType, sizeBytes: buffer.byteLength };
  }

  private async findByContentHash(
    organizationId: string,
    organizationPath: string,
    expectedHash: string,
  ): Promise<string | undefined> {
    let entries;
    try {
      entries = await readdir(organizationPath, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return undefined;
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !SAFE_STORAGE_FILENAME.test(entry.name)) continue;
      const contents = await readFile(join(organizationPath, entry.name));
      const hash = createHash('sha256').update(contents).digest('hex');
      if (hash === expectedHash) return `${organizationId}/${entry.name}`;
    }
    return undefined;
  }

  private resolveStoragePath(storageKey: string): string {
    const [organizationId, fileId] = parseStorageKey(storageKey);
    const resolvedPath = resolve(this.rootPath, organizationId, fileId);
    const pathFromRoot = relative(this.rootPath, resolvedPath);
    if (
      !pathFromRoot ||
      pathFromRoot === '..' ||
      pathFromRoot.startsWith(`..${sep}`) ||
      isAbsolute(pathFromRoot)
    ) {
      throw new Error('Invalid storage key');
    }
    return resolvedPath;
  }
}

const SAFE_STORAGE_FILENAME = /^[A-Za-z0-9_-]+$/;

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
