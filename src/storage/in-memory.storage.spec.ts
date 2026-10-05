import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from './in-memory.storage.js';

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('InMemoryStorage', () => {
  it('stores and returns an organization-scoped CUID key and file contents', async () => {
    const storage = new InMemoryStorage();
    const buffer = Buffer.from('cover-bytes');

    const stored = await storage.save('org-1', buffer, 'image/jpeg');

    expect(stored).toMatchObject({
      storageKey: expect.stringMatching(/^org-1\/[a-z0-9]+$/),
      mimeType: 'image/jpeg',
      sizeBytes: buffer.byteLength,
    });
    expect(storage.files.has(stored.storageKey)).toBe(true);
    expect(await readAll(await storage.get(stored.storageKey))).toEqual(buffer);
    await expect(storage.exists(stored.storageKey)).resolves.toBe(true);

    await storage.delete(stored.storageKey);
    await expect(storage.exists(stored.storageKey)).resolves.toBe(false);
  });

  it('rejects malformed storage keys', async () => {
    const storage = new InMemoryStorage();
    await expect(storage.get('../secret')).rejects.toThrow(
      'Invalid storage key',
    );
    await expect(storage.delete('org-1\\secret')).rejects.toThrow(
      'Invalid storage key',
    );
  });
});
