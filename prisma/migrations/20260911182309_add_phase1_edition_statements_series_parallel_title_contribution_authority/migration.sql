-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "authorityId" TEXT;

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "parallelTitle" TEXT;

-- CreateTable
CREATE TABLE "EditionStatement" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditionStatement_editionId_sortOrder_id_idx" ON "EditionStatement"("editionId", "sortOrder", "id");

-- AddForeignKey
ALTER TABLE "EditionStatement" ADD CONSTRAINT "EditionStatement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
