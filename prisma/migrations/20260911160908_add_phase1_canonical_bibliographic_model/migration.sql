-- CreateEnum
CREATE TYPE "TitleType" AS ENUM ('MAIN', 'PARALLEL', 'VARIANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponsibilityStatementLabel" AS ENUM ('STATEMENT', 'SUBSEQUENT_STATEMENT');

-- CreateEnum
CREATE TYPE "EditionLanguageRole" AS ENUM ('TEXT', 'ORIGINAL_LANGUAGE', 'PARALLEL_TEXT', 'SUBTITLES');

-- CreateEnum
CREATE TYPE "BibliographicNoteType" AS ENUM ('GENERAL', 'BIBLIOGRAPHY', 'CONTENTS', 'SUMMARY', 'PROVENANCE', 'DISSERTATION', 'OTHER');

-- AlterTable
ALTER TABLE "BibliographicRecord" ADD COLUMN     "sourceId" TEXT;

-- CreateTable
CREATE TABLE "WorkTitle" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "type" "TitleType" NOT NULL DEFAULT 'MAIN',
    "value" TEXT NOT NULL,
    "subtitle" TEXT,
    "language" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionTitle" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "type" "TitleType" NOT NULL DEFAULT 'MAIN',
    "value" TEXT NOT NULL,
    "subtitle" TEXT,
    "language" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsibilityStatement" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "label" "ResponsibilityStatementLabel" NOT NULL DEFAULT 'STATEMENT',
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponsibilityStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionLanguage" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "role" "EditionLanguageRole" NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "volumeNumber" TEXT,
    "issn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibliographicNote" (
    "id" TEXT NOT NULL,
    "workId" TEXT,
    "editionId" TEXT,
    "type" "BibliographicNoteType" NOT NULL DEFAULT 'GENERAL',
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibliographicNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "notation" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "systemEdition" TEXT,
    "authorityId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmappedSourceField" (
    "id" TEXT NOT NULL,
    "bibliographicRecordId" TEXT NOT NULL,
    "tag" CHAR(3) NOT NULL,
    "indicator1" CHAR(1),
    "indicator2" CHAR(1),
    "occurrence" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmappedSourceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmappedSourceSubfield" (
    "id" TEXT NOT NULL,
    "unmappedSourceFieldId" TEXT NOT NULL,
    "code" CHAR(1) NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmappedSourceSubfield_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkTitle_workId_sortOrder_id_idx" ON "WorkTitle"("workId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "EditionTitle_editionId_sortOrder_id_idx" ON "EditionTitle"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "ResponsibilityStatement_editionId_sortOrder_id_idx" ON "ResponsibilityStatement"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "EditionLanguage_editionId_sortOrder_id_idx" ON "EditionLanguage"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Series_editionId_sortOrder_id_idx" ON "Series"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "BibliographicNote_workId_sortOrder_id_idx" ON "BibliographicNote"("workId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "BibliographicNote_editionId_sortOrder_id_idx" ON "BibliographicNote"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Classification_editionId_sortOrder_id_idx" ON "Classification"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "UnmappedSourceField_bibliographicRecordId_tag_occurrence_idx" ON "UnmappedSourceField"("bibliographicRecordId", "tag", "occurrence");

-- CreateIndex
CREATE INDEX "UnmappedSourceSubfield_unmappedSourceFieldId_sortOrder_idx" ON "UnmappedSourceSubfield"("unmappedSourceFieldId", "sortOrder");

-- AddForeignKey
ALTER TABLE "WorkTitle" ADD CONSTRAINT "WorkTitle_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionTitle" ADD CONSTRAINT "EditionTitle_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsibilityStatement" ADD CONSTRAINT "ResponsibilityStatement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionLanguage" ADD CONSTRAINT "EditionLanguage_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibliographicNote" ADD CONSTRAINT "BibliographicNote_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibliographicNote" ADD CONSTRAINT "BibliographicNote_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A note targets exactly one of Work or Edition (mirrors the Contribution XOR pattern).
ALTER TABLE "BibliographicNote" ADD CONSTRAINT "BibliographicNote_exactly_one_target"
  CHECK (("workId" IS NOT NULL AND "editionId" IS NULL)
      OR ("workId" IS NULL AND "editionId" IS NOT NULL));

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedSourceField" ADD CONSTRAINT "UnmappedSourceField_bibliographicRecordId_fkey" FOREIGN KEY ("bibliographicRecordId") REFERENCES "BibliographicRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedSourceSubfield" ADD CONSTRAINT "UnmappedSourceSubfield_unmappedSourceFieldId_fkey" FOREIGN KEY ("unmappedSourceFieldId") REFERENCES "UnmappedSourceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "PublicationStatementPart_publicationStatementId_sortOrder_id_id" RENAME TO "PublicationStatementPart_publicationStatementId_sortOrder_i_idx";

-- Backfill: there is no production data. This copies the *existing*
-- transitional scalar values verbatim into the new canonical relations; it
-- does not invent any bibliographic value that was not already present.
-- WorkTitle/EditionTitle/EditionLanguage become the source of truth going
-- forward, while Work.title/Edition.title/Edition.subtitle/Edition.language
-- remain as read/query-convenience projections until a later sub-iteration
-- updates the write paths (parser, preview mapper, import persistence).
INSERT INTO "WorkTitle" ("id", "workId", "type", "value", "subtitle", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'MAIN', "title", "subtitle", 0, "createdAt", "updatedAt"
FROM "Work";

INSERT INTO "EditionTitle" ("id", "editionId", "type", "value", "subtitle", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'MAIN', "title", "subtitle", 0, "createdAt", "updatedAt"
FROM "Edition";

INSERT INTO "EditionLanguage" ("id", "editionId", "code", "role", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "language", 'TEXT', 0, "createdAt", "updatedAt"
FROM "Edition"
WHERE "language" IS NOT NULL;
