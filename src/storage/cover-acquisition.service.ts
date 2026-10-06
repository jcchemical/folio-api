import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
            work: { select: { id: true, organizationId: true } },
            edition: {
              select: {
                id: true,
                workId: true,
                work: { select: { id: true, organizationId: true } },
              },
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
      const context = resolveCandidateContext(candidate.bibliographicRecord);
      if (!context.ok) {
        await this.rejectCandidate(candidate.id, context.error);
        return;
      }
      const { organizationId, editionId } = context;
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

      if (asset.organizationId !== organizationId) {
        await this.rejectCandidate(candidate.id, 'ORGANIZATION_MISMATCH');
        return;
      }

      await this.prisma.$transaction(async (transaction) => {
        if (editionId) {
          const lockedEditions = await lockEditionForCover(
            transaction,
            editionId,
          );
          const lockedEdition = lockedEditions[0];
          if (
            lockedEdition &&
            lockedEdition.organizationId !== organizationId
          ) {
            const rejected = await transaction.coverCandidate.updateMany({
              where: { id: candidate.id, status: 'ACQUIRING' },
              data: {
                status: 'REJECTED',
                rejectReason: 'ORGANIZATION_MISMATCH',
                nextAttemptAt: null,
              },
            });
            if (rejected.count !== 1) {
              throw new Error(
                'Cover candidate claim was lost before rejection.',
              );
            }
            return;
          }

          if (lockedEdition) {
            const activeCover = await transaction.editionCover.findFirst({
              where: { editionId, isActive: true },
              select: { id: true },
            });
            if (!activeCover) {
              await transaction.editionCover.upsert({
                where: {
                  editionId_coverAssetId: {
                    editionId,
                    coverAssetId: asset.id,
                  },
                },
                create: {
                  editionId,
                  coverAssetId: asset.id,
                  isActive: true,
                },
                update: { isActive: true },
              });
            }
          }
        }

        const acquired = await transaction.coverCandidate.updateMany({
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
      });
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

  private async rejectCandidate(
    candidateId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.coverCandidate.updateMany({
      where: { id: candidateId, status: 'ACQUIRING' },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
        nextAttemptAt: null,
      },
    });
  }
}

type CoverCandidateRecord = {
  work: { id: string; organizationId: string } | null;
  edition: {
    id: string;
    workId: string;
    work: { id: string; organizationId: string };
  } | null;
};

function resolveCandidateContext(
  record: CoverCandidateRecord,
):
  | { ok: true; organizationId: string; editionId: string | null }
  | { ok: false; error: string } {
  const workOrganizationId = record.work?.organizationId;
  const editionOrganizationId = record.edition?.work.organizationId;
  if (
    workOrganizationId &&
    editionOrganizationId &&
    workOrganizationId !== editionOrganizationId
  ) {
    return { ok: false, error: 'ORGANIZATION_MISMATCH' };
  }
  if (
    record.work &&
    record.edition &&
    record.work.id !== record.edition.workId
  ) {
    return { ok: false, error: 'INCONSISTENT_BIBLIOGRAPHIC_RECORD' };
  }

  const organizationId = editionOrganizationId ?? workOrganizationId;
  if (!organizationId) {
    return { ok: false, error: 'NO_OWNING_ORGANIZATION' };
  }
  return { ok: true, organizationId, editionId: record.edition?.id ?? null };
}

async function lockEditionForCover(
  transaction: Prisma.TransactionClient,
  editionId: string,
): Promise<Array<{ id: string; organizationId: string }>> {
  return transaction.$queryRaw<Array<{ id: string; organizationId: string }>>`
    SELECT edition."id", work."organizationId"
    FROM "Edition" AS edition
    INNER JOIN "Work" AS work ON work."id" = edition."workId"
    WHERE edition."id" = ${editionId}
    FOR UPDATE OF edition, work
  `;
}
