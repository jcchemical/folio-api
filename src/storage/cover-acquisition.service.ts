import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SafeHttpFetcherService } from './safe-http-fetcher.js';
import {
  getConfiguredStorageBackend,
  STORAGE_SERVICE,
  type StorageService,
} from './storage.service.js';

export interface CoverAcquisitionService {
  acquire(candidateId: string): Promise<void>;
  acquireAllPending(): Promise<void>;
  scheduleRetry(candidateId: string): Promise<void>;
}

const MAX_RETRIES = 5;
const PENDING_SCAN_INTERVAL_MS = 60_000;
const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const MAX_RETRY_BACKOFF_MS = RETRY_BACKOFF_MS.at(-1)!;

@Injectable()
export class CoverAcquisitionServiceImpl
  implements CoverAcquisitionService, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CoverAcquisitionServiceImpl.name);
  private pendingScanTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: SafeHttpFetcherService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.startPendingScan();
    this.pendingScanTimer = setInterval(
      () => this.startPendingScan(),
      PENDING_SCAN_INTERVAL_MS,
    );
    this.pendingScanTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.pendingScanTimer) clearInterval(this.pendingScanTimer);
  }

  async acquire(candidateId: string): Promise<void> {
    const now = new Date();
    const candidate = await this.prisma.coverCandidate.findFirst({
      where: {
        id: candidateId,
        status: 'PENDING',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      select: {
        id: true,
        url: true,
        bibliographicRecord: {
          select: {
            work: { select: { organizationId: true } },
            edition: {
              select: { work: { select: { organizationId: true } } },
            },
          },
        },
      },
    });
    if (!candidate) return;

    const claim = await this.prisma.coverCandidate.updateMany({
      where: {
        id: candidate.id,
        status: 'PENDING',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: { status: 'ACQUIRING', nextAttemptAt: null },
    });
    if (claim.count !== 1) return;

    try {
      const organizationId = resolveOrganizationId(
        candidate.bibliographicRecord,
      );
      const image = await this.fetcher.fetch(candidate.url);
      const contentHash = createHash('sha256')
        .update(image.buffer)
        .digest('hex');
      const assetKey = {
        organizationId_contentHash: { organizationId, contentHash },
      };

      let asset = await this.prisma.coverAsset.findUnique({
        where: assetKey,
      });

      if (!asset) {
        const stored = await this.storage.save(
          organizationId,
          image.buffer,
          image.mimeType,
        );
        asset = await this.prisma.coverAsset.upsert({
          where: assetKey,
          create: {
            organizationId,
            storageBackend: getConfiguredStorageBackend(),
            storageKey: stored.storageKey,
            contentHash,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            width: image.width,
            height: image.height,
          },
          update: {},
        });
      }

      const acquired = await this.prisma.coverCandidate.updateMany({
        where: { id: candidate.id, status: 'ACQUIRING' },
        data: {
          status: 'ACQUIRED',
          coverAssetId: asset.id,
          mimeType: image.mimeType,
          rejectReason: null,
          nextAttemptAt: null,
        },
      });
      if (acquired.count !== 1) {
        throw new Error('Cover candidate claim was lost before completion.');
      }
    } catch {
      await this.scheduleRetry(candidate.id);
      this.logger.warn(
        `Cover acquisition failed for candidate ${candidate.id}; retry scheduled.`,
      );
    }
  }

  async acquireAllPending(): Promise<void> {
    const now = new Date();
    const pending = await this.prisma.coverCandidate.findMany({
      where: {
        status: 'PENDING',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const candidate of pending) {
      try {
        await this.acquire(candidate.id);
      } catch {
        this.logger.warn(`Could not acquire cover candidate ${candidate.id}.`);
      }
    }
  }

  private startPendingScan(): void {
    void this.acquireAllPending().catch(() => {
      this.logger.error('Could not scan pending cover candidates.');
    });
  }

  async scheduleRetry(candidateId: string): Promise<void> {
    const candidate = await this.prisma.coverCandidate.findUnique({
      where: { id: candidateId },
      select: { status: true, retryCount: true },
    });
    if (!candidate || candidate.status !== 'ACQUIRING') return;

    if (candidate.retryCount >= MAX_RETRIES) {
      await this.prisma.coverCandidate.updateMany({
        where: {
          id: candidateId,
          status: 'ACQUIRING',
          retryCount: candidate.retryCount,
        },
        data: {
          status: 'REJECTED',
          rejectReason: 'MAX_RETRIES_EXCEEDED',
          nextAttemptAt: null,
        },
      });
      return;
    }

    const backoff =
      RETRY_BACKOFF_MS[candidate.retryCount] ?? MAX_RETRY_BACKOFF_MS;
    await this.prisma.coverCandidate.updateMany({
      where: {
        id: candidateId,
        status: 'ACQUIRING',
        retryCount: candidate.retryCount,
      },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + backoff),
      },
    });
  }
}

function resolveOrganizationId(record: {
  work: { organizationId: string } | null;
  edition: { work: { organizationId: string } } | null;
}): string {
  const workOrganizationId = record.work?.organizationId;
  const editionOrganizationId = record.edition?.work.organizationId;
  if (
    workOrganizationId &&
    editionOrganizationId &&
    workOrganizationId !== editionOrganizationId
  ) {
    throw new Error(
      'Cover candidate record belongs to inconsistent organizations.',
    );
  }

  const organizationId = editionOrganizationId ?? workOrganizationId;
  if (!organizationId) {
    throw new Error('Cover candidate has no owning organization.');
  }
  return organizationId;
}
