import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SafeHttpFetcherService } from './safe-http-fetcher.js';
import type { StorageService } from './storage.service.js';
import { CoverAcquisitionServiceImpl } from './cover-acquisition.service.js';

const imageBuffer = Buffer.from('valid fetched image bytes');
const fetchedImage = {
  buffer: imageBuffer,
  mimeType: 'image/png',
  sizeBytes: imageBuffer.length,
  width: 2,
  height: 3,
};
const existingAsset = {
  id: 'asset-1',
  organizationId: 'org-1',
  storageBackend: 'in_memory',
  storageKey: 'org-1/file-1',
  contentHash: createHash('sha256').update(imageBuffer).digest('hex'),
  mimeType: 'image/png',
  sizeBytes: imageBuffer.length,
  width: 2,
  height: 3,
};

afterEach(() => {
  vi.useRealTimers();
});

describe('CoverAcquisitionService', () => {
  function createFixture(
    options: {
      retryCount?: number;
      existingAsset?: typeof existingAsset | null;
      fetchError?: Error;
    } = {},
  ) {
    const candidate = {
      id: 'candidate-1',
      url: 'https://images.porbase.pt/cover.png',
      retryCount: options.retryCount ?? 0,
      bibliographicRecord: {
        work: { organizationId: 'org-1' },
        edition: null,
      },
    };
    const prisma = {
      coverCandidate: {
        findFirst: vi.fn().mockResolvedValue(candidate),
        findMany: vi.fn().mockResolvedValue([{ id: candidate.id }]),
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACQUIRING',
          retryCount: options.retryCount ?? 0,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      coverAsset: {
        findUnique: vi.fn().mockResolvedValue(options.existingAsset ?? null),
        upsert: vi.fn().mockResolvedValue(existingAsset),
      },
    };
    const fetcher = {
      fetch: options.fetchError
        ? vi.fn().mockRejectedValue(options.fetchError)
        : vi.fn().mockResolvedValue(fetchedImage),
    };
    const storage = {
      save: vi.fn().mockResolvedValue({
        storageKey: 'org-1/file-1',
        mimeType: 'image/png',
        sizeBytes: imageBuffer.length,
      }),
      get: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };
    const service = new CoverAcquisitionServiceImpl(
      prisma as unknown as PrismaService,
      fetcher as unknown as SafeHttpFetcherService,
      storage as StorageService,
    );
    return { service, prisma, fetcher, storage, candidate };
  }

  it('acquires a pending candidate and persists its asset', async () => {
    const { service, prisma, fetcher, storage, candidate } = createFixture();

    await service.acquire(candidate.id);

    expect(fetcher.fetch).toHaveBeenCalledWith(candidate.url);
    expect(storage.save).toHaveBeenCalledWith(
      'org-1',
      imageBuffer,
      'image/png',
    );
    expect(prisma.coverAsset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_contentHash: {
            organizationId: 'org-1',
            contentHash: existingAsset.contentHash,
          },
        },
        create: expect.objectContaining({
          organizationId: 'org-1',
          storageKey: 'org-1/file-1',
          contentHash: existingAsset.contentHash,
          mimeType: 'image/png',
          sizeBytes: imageBuffer.length,
          width: 2,
          height: 3,
        }),
      }),
    );
    expect(prisma.coverCandidate.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: candidate.id,
          status: 'PENDING',
        }),
        data: { status: 'ACQUIRING', nextAttemptAt: null },
      }),
    );
    expect(prisma.coverCandidate.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: candidate.id, status: 'ACQUIRING' },
        data: expect.objectContaining({
          status: 'ACQUIRED',
          coverAssetId: existingAsset.id,
          mimeType: 'image/png',
          nextAttemptAt: null,
        }),
      }),
    );
  });

  it('reuses an existing asset with the same organization-scoped content hash', async () => {
    const { service, prisma, fetcher, storage } = createFixture({
      existingAsset,
    });

    await service.acquire('candidate-1');

    expect(fetcher.fetch).toHaveBeenCalledOnce();
    expect(prisma.coverAsset.upsert).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.coverCandidate.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACQUIRED',
          coverAssetId: existingAsset.id,
        }),
      }),
    );
  });

  it.each([
    [0, 60_000],
    [1, 5 * 60_000],
    [2, 15 * 60_000],
    [3, 60 * 60_000],
  ])(
    'schedules retryCount %i with %i ms backoff',
    async (retryCount, delayMs) => {
      const now = new Date('2026-10-06T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const { service, prisma } = createFixture({ retryCount });

      await service.scheduleRetry('candidate-1');

      expect(prisma.coverCandidate.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'candidate-1',
          status: 'ACQUIRING',
          retryCount,
        },
        data: {
          status: 'PENDING',
          retryCount: { increment: 1 },
          nextAttemptAt: new Date(now.getTime() + delayMs),
        },
      });
    },
  );

  it('rejects a candidate after the maximum number of retries', async () => {
    const { service, prisma } = createFixture({ retryCount: 5 });

    await service.scheduleRetry('candidate-1');

    expect(prisma.coverCandidate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'candidate-1',
        status: 'ACQUIRING',
        retryCount: 5,
      },
      data: {
        status: 'REJECTED',
        rejectReason: 'MAX_RETRIES_EXCEEDED',
        nextAttemptAt: null,
      },
    });
  });

  it('schedules a retry when image fetching fails', async () => {
    const { service, prisma, storage } = createFixture({
      fetchError: new Error('upstream failure'),
    });
    prisma.coverCandidate.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await service.acquire('candidate-1');

    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.coverCandidate.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: { increment: 1 },
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });

  it('uses an atomic claim so concurrent workers fetch a candidate only once', async () => {
    let status = 'PENDING';
    const fixture = createFixture();
    fixture.prisma.coverCandidate.findFirst.mockImplementation(async () =>
      status === 'PENDING' ? fixture.candidate : null,
    );
    fixture.prisma.coverCandidate.updateMany.mockImplementation(
      async ({ where, data }) => {
        if (status !== where.status) return { count: 0 };
        status = data.status;
        return { count: 1 };
      },
    );
    const secondProcess = new CoverAcquisitionServiceImpl(
      fixture.prisma as unknown as PrismaService,
      fixture.fetcher as unknown as SafeHttpFetcherService,
      fixture.storage as StorageService,
    );

    await Promise.all([
      fixture.service.acquire('candidate-1'),
      secondProcess.acquire('candidate-1'),
    ]);

    expect(fixture.fetcher.fetch).toHaveBeenCalledOnce();
    expect(fixture.storage.save).toHaveBeenCalledOnce();
    expect(status).toBe('ACQUIRED');
  });

  it('scans only pending candidates whose retry is due', async () => {
    const { service, prisma, candidate } = createFixture();

    await service.acquireAllPending();

    expect(prisma.coverCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: expect.any(Date) } },
          ],
        },
        select: { id: true },
      }),
    );
    expect(prisma.coverCandidate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: candidate.id }),
      }),
    );
  });
});
