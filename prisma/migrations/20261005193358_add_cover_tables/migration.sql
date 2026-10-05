-- CreateTable
CREATE TABLE "CoverCandidate" (
    "id" TEXT NOT NULL,
    "bibliographicRecordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'PORBASE',
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "coverAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextAttemptAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoverCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storageBackend" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionCover" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "coverAssetId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditionCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverCandidate_status_idx" ON "CoverCandidate"("status");

-- CreateIndex
CREATE INDEX "CoverCandidate_nextAttemptAt_idx" ON "CoverCandidate"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "CoverCandidate_sourceType_idx" ON "CoverCandidate"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "CoverCandidate_bibliographicRecordId_urlHash_key" ON "CoverCandidate"("bibliographicRecordId", "urlHash");

-- CreateIndex
CREATE INDEX "CoverAsset_storageBackend_idx" ON "CoverAsset"("storageBackend");

-- CreateIndex
CREATE UNIQUE INDEX "CoverAsset_organizationId_contentHash_key" ON "CoverAsset"("organizationId", "contentHash");

-- CreateIndex
CREATE INDEX "EditionCover_isActive_idx" ON "EditionCover"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EditionCover_editionId_coverAssetId_key" ON "EditionCover"("editionId", "coverAssetId");

-- AddForeignKey
ALTER TABLE "CoverCandidate" ADD CONSTRAINT "CoverCandidate_bibliographicRecordId_fkey" FOREIGN KEY ("bibliographicRecordId") REFERENCES "BibliographicRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverCandidate" ADD CONSTRAINT "CoverCandidate_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "CoverAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverAsset" ADD CONSTRAINT "CoverAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionCover" ADD CONSTRAINT "EditionCover_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionCover" ADD CONSTRAINT "EditionCover_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "CoverAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
