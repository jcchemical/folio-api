-- Deliberate development reset target: this migration is intended for a fresh database.
-- Existing development data is not backfilled because the old flat model cannot
-- reliably reconstruct 215 field occurrences.

-- Drop the old flat representation.
DROP TABLE "PhysicalDescription";

ALTER TABLE "Edition" RENAME COLUMN "pages" TO "pageCount";
ALTER TABLE "Edition" DROP COLUMN "publishDate";
ALTER TABLE "Edition" ADD COLUMN "publicationDate" VARCHAR(10);

CREATE TABLE "PhysicalDescription" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalDescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhysicalDescriptionPart" (
    "id" TEXT NOT NULL,
    "physicalDescriptionId" TEXT NOT NULL,
    "subfield" CHAR(1) NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "normalizedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalDescriptionPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhysicalDescription_editionId_sortOrder_id_idx"
ON "PhysicalDescription"("editionId", "sortOrder", "id");

CREATE INDEX "PhysicalDescriptionPart_physicalDescriptionId_sortOrder_id_idx"
ON "PhysicalDescriptionPart"("physicalDescriptionId", "sortOrder", "id");

ALTER TABLE "PhysicalDescription"
ADD CONSTRAINT "PhysicalDescription_editionId_fkey"
FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhysicalDescriptionPart"
ADD CONSTRAINT "PhysicalDescriptionPart_physicalDescriptionId_fkey"
FOREIGN KEY ("physicalDescriptionId") REFERENCES "PhysicalDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
