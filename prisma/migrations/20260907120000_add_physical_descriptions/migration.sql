-- CreateTable
CREATE TABLE "PhysicalDescription" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "subfield" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "normalizedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalDescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysicalDescription_editionId_sortOrder_id_idx"
ON "PhysicalDescription"("editionId", "sortOrder", "id");

-- AddForeignKey
ALTER TABLE "PhysicalDescription"
ADD CONSTRAINT "PhysicalDescription_editionId_fkey"
FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;