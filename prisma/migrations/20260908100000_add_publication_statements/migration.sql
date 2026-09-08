-- Add repeatable, ordered UNIMARC 210 publication statements.
-- Existing scalar Edition publication fields are intentionally not backfilled.

ALTER TABLE "Edition"
ADD COLUMN "publicationPlace" TEXT;

CREATE TABLE "PublicationStatement" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "indicator1" CHAR(1) NOT NULL DEFAULT ' ',
    "indicator2" CHAR(1) NOT NULL DEFAULT '9',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicationStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationStatementPart" (
    "id" TEXT NOT NULL,
    "publicationStatementId" TEXT NOT NULL,
    "subfield" CHAR(1) NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "normalizedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicationStatementPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicationStatement_editionId_sortOrder_id_idx"
ON "PublicationStatement"("editionId", "sortOrder", "id");

CREATE INDEX "PublicationStatementPart_publicationStatementId_sortOrder_id_idx"
ON "PublicationStatementPart"("publicationStatementId", "sortOrder", "id");

ALTER TABLE "PublicationStatement"
ADD CONSTRAINT "PublicationStatement_editionId_fkey"
FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationStatementPart"
ADD CONSTRAINT "PublicationStatementPart_publicationStatementId_fkey"
FOREIGN KEY ("publicationStatementId") REFERENCES "PublicationStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
