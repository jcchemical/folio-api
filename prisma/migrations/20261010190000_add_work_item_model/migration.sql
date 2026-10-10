-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('IDENTIFIED', 'NEEDS_REVIEW', 'VALIDATED');

-- CreateEnum
CREATE TYPE "WorkItemSource" AS ENUM ('SCAN', 'MANUAL');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "WorkItemSource" NOT NULL,
    "rawValue" TEXT NOT NULL,
    "matchedItemId" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkItem_organizationId_status_idx" ON "WorkItem"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_matchedItemId_fkey" FOREIGN KEY ("matchedItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
