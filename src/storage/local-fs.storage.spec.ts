import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFsStorage } from './local-fs.storage.js';

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('LocalFsStorage', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'folio-cover-storage-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates organization directories and reads, tests, and deletes files', async () => {
    const storage = new LocalFsStorage(root);
    const bytes = Buffer.from('jpeg-content');
    const stored = await storage.save('org-1', bytes, 'image/jpeg');

    expect(stored).toMatchObject({
      storageKey: expect.stringMatching(/^org-1\/[a-z0-9]+$/),
      mimeType: 'image/jpeg',
      sizeBytes: bytes.byteLength,
    });
    await expect(readFile(join(root, stored.storageKey))).resolves.toEqual(
      bytes,
    );
    await expect(storage.exists(stored.storageKey)).resolves.toBe(true);
    await expect(
      readAll(await storage.get(stored.storageKey)),
    ).resolves.toEqual(bytes);

    await storage.delete(stored.storageKey);
    await expect(storage.exists(stored.storageKey)).resolves.toBe(false);
  });

  it('deduplicates by SHA-256 within an organization across adapter instances', async () => {
    const bytes = Buffer.from('same image');
    const first = await new LocalFsStorage(root).save(
      'org-1',
      bytes,
      'image/jpeg',
    );
    const duplicate = await new LocalFsStorage(root).save(
      'org-1',
      Buffer.from(bytes),
      'image/png',
    );
    const otherOrganization = await new LocalFsStorage(root).save(
      'org-2',
      bytes,
      'image/jpeg',
    );

    expect(duplicate.storageKey).toBe(first.storageKey);
    expect(otherOrganization.storageKey).not.toBe(first.storageKey);
    expect(duplicate.sizeBytes).toBe(bytes.byteLength);
  });

  it.each(['../secret', 'org-1/../secret', 'org-1\\secret', '/etc/passwd'])(
    'rejects unsafe storage key %s',
    async (storageKey) => {
      const storage = new LocalFsStorage(root);
      await expect(storage.exists(storageKey)).rejects.toThrow(
        'Invalid storage key',
      );
      await expect(storage.delete(storageKey)).rejects.toThrow(
        'Invalid storage key',
      );
    },
  );

  it('rejects unsafe organization IDs before creating files', async () => {
    const storage = new LocalFsStorage(root);
    await expect(
      storage.save('../outside', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow('Invalid organization id');
  });
});
