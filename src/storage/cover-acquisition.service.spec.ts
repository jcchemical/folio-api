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
      storageError?: Error;
      activeCover?: { id: string } | null;
      editionMissing?: boolean;
      lockedEditionOrganizationId?: string;
    } = {},
  ) {
    const candidate = {
      id: 'candidate-1',
      url: 'https://images.porbase.pt/cover.png',
      retryCount: options.retryCount ?? 0,
      bibliographicRecord: {
        edition: {
          id: 'edition-1',
          work: { id: 'work-1', organizationId: 'org-1' },
        },
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
      save: options.storageError
        ? vi.fn().mockRejectedValue(options.storageError)
        : vi.fn().mockResolvedValue({
            storageKey: 'org-1/file-1',
            mimeType: 'image/png',
            sizeBytes: imageBuffer.length,
          }),
      get: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };
    const transaction = {
      coverCandidate: prisma.coverCandidate,
      editionCover: {
        findFirst: vi.fn().mockResolvedValue(options.activeCover ?? null),
        upsert: vi.fn().mockResolvedValue({ id: 'edition-cover-1' }),
      },
      $queryRaw: vi.fn().mockResolvedValue(
        options.editionMissing
          ? []
          : [
              {
                id: 'edition-1',
                organizationId: options.lockedEditionOrganizationId ?? 'org-1',
              },
            ],
      ),
    };
    Object.assign(prisma, {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    });
    const service = new CoverAcquisitionServiceImpl(
      prisma as unknown as PrismaService,
      fetcher as unknown as SafeHttpFetcherService,
      storage as StorageService,
    );
    return { service, prisma, fetcher, storage, candidate, transaction };
  }

  it('acquires a pending candidate and persists its asset', async () => {
    const { service, prisma, fetcher, storage, candidate, transaction } =
      createFixture();

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
    expect(transaction.editionCover.upsert).toHaveBeenCalledWith({
      where: {
        editionId_coverAssetId: {
          editionId: 'edition-1',
          coverAssetId: existingAsset.id,
        },
      },
      create: {
        editionId: 'edition-1',
        coverAssetId: existingAsset.id,
        isActive: true,
      },
      update: { isActive: true },
    });
    expect(transaction.editionCover.findFirst).toHaveBeenCalledWith({
      where: { editionId: 'edition-1', isActive: true },
      select: { id: true },
    });
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
  });

  it('reuses an existing asset with the same organization-scoped content hash', async () => {
    const { service, prisma, fetcher, storage, transaction } = createFixture({
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
    expect(transaction.editionCover.upsert).toHaveBeenCalledOnce();
  });

  it('keeps the acquired asset without an invalid association if the Edition disappeared', async () => {
    const { service, candidate, transaction } = createFixture({
      editionMissing: true,
    });

    await service.acquire(candidate.id);

    expect(transaction.editionCover.upsert).not.toHaveBeenCalled();
    expect(transaction.coverCandidate.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACQUIRED' }),
      }),
    );
  });

  it('rejects an organization mismatch discovered under the Edition lock', async () => {
    const { service, prisma, transaction } = createFixture({
      lockedEditionOrganizationId: 'org-2',
    });

    await service.acquire('candidate-1');

    expect(prisma.coverAsset.upsert).toHaveBeenCalledOnce();
    expect(transaction.editionCover.upsert).not.toHaveBeenCalled();
    expect(prisma.coverCandidate.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'candidate-1', status: 'ACQUIRING' },
      data: {
        status: 'REJECTED',
        rejectReason: 'ORGANIZATION_MISMATCH',
        nextAttemptAt: null,
      },
    });
  });

  it('preserves an already-active Edition cover', async () => {
    const { service, transaction } = createFixture({
      activeCover: { id: 'existing-active-cover' },
    });

    await service.acquire('candidate-1');

    expect(transaction.editionCover.findFirst).toHaveBeenCalledOnce();
    expect(transaction.editionCover.upsert).not.toHaveBeenCalled();
  });

  it('does not fetch candidates that are already rejected or processed', async () => {
    const { service, prisma, fetcher, storage } = createFixture();
    prisma.coverCandidate.findFirst.mockResolvedValue(null);

    await service.acquire('candidate-1');

    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.coverCandidate.updateMany).not.toHaveBeenCalled();
  });

  it('schedules retry when storage fails after a valid image download', async () => {
    const { service, prisma, fetcher, storage } = createFixture({
      storageError: new Error('storage unavailable'),
    });
    prisma.coverCandidate.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await service.acquire('candidate-1');

    expect(fetcher.fetch).toHaveBeenCalledOnce();
    expect(storage.save).toHaveBeenCalledOnce();
    expect(prisma.coverAsset.upsert).not.toHaveBeenCalled();
    expect(prisma.coverCandidate.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: { increment: 1 },
        }),
      }),
    );
  });

  it('keeps a persisted asset and schedules retry if EditionCover conflicts', async () => {
    const { service, prisma, transaction } = createFixture();
    transaction.editionCover.upsert.mockRejectedValue(
      Object.assign(new Error('unique conflict'), { code: 'P2002' }),
    );
    prisma.coverCandidate.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    await service.acquire('candidate-1');

    expect(prisma.coverAsset.upsert).toHaveBeenCalledOnce();
    expect(transaction.coverCandidate.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACQUIRED' }),
      }),
    );
    expect(prisma.coverCandidate.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: { increment: 1 },
        }),
      }),
    );
  });

  it('reuses a hash-deduplicated asset for a second candidate with the same content', async () => {
    const first = createFixture();
    await first.service.acquire('candidate-1');
    const second = createFixture({ existingAsset });
    second.candidate.id = 'candidate-2';

    await second.service.acquire('candidate-2');

    expect(first.prisma.coverAsset.upsert).toHaveBeenCalledOnce();
    expect(second.prisma.coverAsset.upsert).not.toHaveBeenCalled();
    expect(second.transaction.editionCover.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ coverAssetId: existingAsset.id }),
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
