-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'READER');

-- CreateEnum
CREATE TYPE "AgentKind" AS ENUM ('PERSON', 'CORPORATE_BODY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContributionSource" AS ENUM ('PORBASE', 'MANUAL');

-- CreateEnum
CREATE TYPE "TitleType" AS ENUM ('MAIN', 'PARALLEL', 'VARIANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponsibilityStatementLabel" AS ENUM ('STATEMENT', 'SUBSEQUENT_STATEMENT');

-- CreateEnum
CREATE TYPE "EditionLanguageRole" AS ENUM ('TEXT', 'ORIGINAL_LANGUAGE', 'PARALLEL_TEXT', 'SUBTITLES');

-- CreateEnum
CREATE TYPE "BibliographicNoteType" AS ENUM ('GENERAL', 'BIBLIOGRAPHY', 'CONTENTS', 'SUMMARY', 'PROVENANCE', 'DISSERTATION', 'OTHER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCatalogueSource" TEXT DEFAULT 'porbase',
    "enabledCatalogueSources" TEXT[] DEFAULT ARRAY['porbase']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "isbn10" CHAR(10),
    "isbn13" CHAR(13),
    "publisher" TEXT,
    "publicationDate" VARCHAR(10),
    "publicationPlace" TEXT,
    "language" TEXT,
    "country" TEXT,
    "format" TEXT,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workId" TEXT NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

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
    "parallelTitle" TEXT,
    "volumeNumber" TEXT,
    "issn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
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

-- CreateTable
CREATE TABLE "PublicationStatementPart" (
    "id" TEXT NOT NULL,
    "publicationStatementId" TEXT NOT NULL,
    "subfield" CHAR(1) NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groupIndex" INTEGER NOT NULL DEFAULT 0,
    "normalizedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationStatementPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalDescription" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "AgentKind" NOT NULL DEFAULT 'UNKNOWN',
    "displayName" TEXT NOT NULL,
    "normalizedDisplayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workId" TEXT,
    "editionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roleLabel" TEXT,
    "relationshipCodeScheme" TEXT,
    "authorityId" TEXT,
    "source" "ContributionSource" NOT NULL,
    "sourceTag" CHAR(3),
    "indicator1" CHAR(1),
    "indicator2" CHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionSourcePart" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "code" CHAR(1) NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionSourcePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentifier" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" TEXT NOT NULL,

    CONSTRAINT "ExternalIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibliographicRecord" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "source" TEXT,
    "remoteId" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editionId" TEXT NOT NULL,

    CONSTRAINT "BibliographicRecord_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OWNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "holdingId" TEXT NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "callNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_id_idx" ON "User"("createdAt", "id");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_userId_idx" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Library_organizationId_createdAt_id_idx" ON "Library"("organizationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Library_organizationId_name_key" ON "Library"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Location_libraryId_createdAt_id_idx" ON "Location"("libraryId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Location_libraryId_name_key" ON "Location"("libraryId", "name");

-- CreateIndex
CREATE INDEX "Work_organizationId_createdAt_id_idx" ON "Work"("organizationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Edition_workId_createdAt_id_idx" ON "Edition"("workId", "createdAt", "id");

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
CREATE INDEX "EditionStatement_editionId_sortOrder_id_idx" ON "EditionStatement"("editionId", "sortOrder", "id");

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

-- CreateIndex
CREATE INDEX "PublicationStatement_editionId_sortOrder_id_idx" ON "PublicationStatement"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "PublicationStatementPart_publicationStatementId_sortOrder_i_idx" ON "PublicationStatementPart"("publicationStatementId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "PhysicalDescription_editionId_sortOrder_id_idx" ON "PhysicalDescription"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "PhysicalDescriptionPart_physicalDescriptionId_sortOrder_id_idx" ON "PhysicalDescriptionPart"("physicalDescriptionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Agent_organizationId_kind_normalizedDisplayName_idx" ON "Agent"("organizationId", "kind", "normalizedDisplayName");

-- CreateIndex
CREATE INDEX "Agent_organizationId_displayName_idx" ON "Agent"("organizationId", "displayName");

-- CreateIndex
CREATE INDEX "Contribution_workId_sortOrder_id_idx" ON "Contribution"("workId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Contribution_editionId_sortOrder_id_idx" ON "Contribution"("editionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Contribution_agentId_idx" ON "Contribution"("agentId");

-- CreateIndex
CREATE INDEX "ContributionSourcePart_contributionId_sortOrder_id_idx" ON "ContributionSourcePart"("contributionId", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_editionId_createdAt_id_idx" ON "ExternalIdentifier"("editionId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentifier_editionId_type_value_key" ON "ExternalIdentifier"("editionId", "type", "value");

-- CreateIndex
CREATE INDEX "BibliographicRecord_editionId_createdAt_id_idx" ON "BibliographicRecord"("editionId", "createdAt", "id");

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

-- CreateIndex
CREATE INDEX "Item_holdingId_createdAt_id_idx" ON "Item"("holdingId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Holding_editionId_createdAt_id_idx" ON "Holding"("editionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Holding_locationId_createdAt_id_idx" ON "Holding"("locationId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "EditionStatement" ADD CONSTRAINT "EditionStatement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibliographicNote" ADD CONSTRAINT "BibliographicNote_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibliographicNote" ADD CONSTRAINT "BibliographicNote_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedSourceField" ADD CONSTRAINT "UnmappedSourceField_bibliographicRecordId_fkey" FOREIGN KEY ("bibliographicRecordId") REFERENCES "BibliographicRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedSourceSubfield" ADD CONSTRAINT "UnmappedSourceSubfield_unmappedSourceFieldId_fkey" FOREIGN KEY ("unmappedSourceFieldId") REFERENCES "UnmappedSourceField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationStatement" ADD CONSTRAINT "PublicationStatement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationStatementPart" ADD CONSTRAINT "PublicationStatementPart_publicationStatementId_fkey" FOREIGN KEY ("publicationStatementId") REFERENCES "PublicationStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalDescription" ADD CONSTRAINT "PhysicalDescription_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalDescriptionPart" ADD CONSTRAINT "PhysicalDescriptionPart_physicalDescriptionId_fkey" FOREIGN KEY ("physicalDescriptionId") REFERENCES "PhysicalDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionSourcePart" ADD CONSTRAINT "ContributionSourcePart_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibliographicRecord" ADD CONSTRAINT "BibliographicRecord_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints that span persisted ownership paths cannot be represented by a
-- single Prisma relation. Deferred constraint triggers validate them at the
-- end of each transaction, including changes to a parent ownership path.

ALTER TABLE "Contribution"
    ADD CONSTRAINT "Contribution_exactly_one_target"
    CHECK (("workId" IS NOT NULL AND "editionId" IS NULL)
            OR ("workId" IS NULL AND "editionId" IS NOT NULL));

ALTER TABLE "BibliographicNote"
    ADD CONSTRAINT "BibliographicNote_exactly_one_target"
    CHECK (("workId" IS NOT NULL AND "editionId" IS NULL)
            OR ("workId" IS NULL AND "editionId" IS NOT NULL));

CREATE UNIQUE INDEX "EditionCover_one_active_per_edition_key"
    ON "EditionCover"("editionId")
    WHERE "isActive" = true;

CREATE FUNCTION "assert_holding_organization_consistency"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    affected_holding_ids TEXT[];
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'Holding' THEN
            affected_holding_ids := ARRAY[NEW."id"];
        WHEN 'Edition' THEN
            SELECT array_agg(h."id") INTO affected_holding_ids
            FROM "Holding" h WHERE h."editionId" = NEW."id";
        WHEN 'Work' THEN
            SELECT array_agg(h."id") INTO affected_holding_ids
            FROM "Holding" h JOIN "Edition" e ON e."id" = h."editionId"
            WHERE e."workId" = NEW."id";
        WHEN 'Location' THEN
            SELECT array_agg(h."id") INTO affected_holding_ids
            FROM "Holding" h WHERE h."locationId" = NEW."id";
        WHEN 'Library' THEN
            SELECT array_agg(h."id") INTO affected_holding_ids
            FROM "Holding" h JOIN "Location" l ON l."id" = h."locationId"
            WHERE l."libraryId" = NEW."id";
        ELSE
            RETURN NULL;
    END CASE;

    IF EXISTS (
        SELECT 1
        FROM "Holding" h
        JOIN "Edition" e ON e."id" = h."editionId"
        JOIN "Work" w ON w."id" = e."workId"
        JOIN "Location" l ON l."id" = h."locationId"
        JOIN "Library" lib ON lib."id" = l."libraryId"
        WHERE h."id" = ANY(affected_holding_ids)
            AND w."organizationId" <> lib."organizationId"
    ) THEN
        RAISE EXCEPTION 'Holding Edition and Location must belong to the same Organization.'
            USING ERRCODE = '23514', CONSTRAINT = 'Holding_same_organization';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Holding_same_organization_from_holding"
    AFTER INSERT OR UPDATE ON "Holding" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_holding_organization_consistency"();
CREATE CONSTRAINT TRIGGER "Holding_same_organization_from_edition"
    AFTER INSERT OR UPDATE ON "Edition" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_holding_organization_consistency"();
CREATE CONSTRAINT TRIGGER "Holding_same_organization_from_work"
    AFTER INSERT OR UPDATE ON "Work" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_holding_organization_consistency"();
CREATE CONSTRAINT TRIGGER "Holding_same_organization_from_location"
    AFTER INSERT OR UPDATE ON "Location" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_holding_organization_consistency"();
CREATE CONSTRAINT TRIGGER "Holding_same_organization_from_library"
    AFTER INSERT OR UPDATE ON "Library" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_holding_organization_consistency"();

CREATE FUNCTION "assert_contribution_agent_organization"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    affected_contribution_ids TEXT[];
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'Contribution' THEN
            affected_contribution_ids := ARRAY[NEW."id"];
        WHEN 'Agent' THEN
            SELECT array_agg(c."id") INTO affected_contribution_ids
            FROM "Contribution" c WHERE c."agentId" = NEW."id";
        WHEN 'Work' THEN
            SELECT array_agg(c."id") INTO affected_contribution_ids
            FROM "Contribution" c
            LEFT JOIN "Edition" e ON e."id" = c."editionId"
            WHERE c."workId" = NEW."id" OR e."workId" = NEW."id";
        WHEN 'Edition' THEN
            SELECT array_agg(c."id") INTO affected_contribution_ids
            FROM "Contribution" c WHERE c."editionId" = NEW."id";
        ELSE
            RETURN NULL;
    END CASE;

    IF EXISTS (
        SELECT 1
        FROM "Contribution" c
        JOIN "Agent" a ON a."id" = c."agentId"
        LEFT JOIN "Work" w ON w."id" = c."workId"
        LEFT JOIN "Edition" e ON e."id" = c."editionId"
        LEFT JOIN "Work" edition_work ON edition_work."id" = e."workId"
        WHERE c."id" = ANY(affected_contribution_ids)
            AND a."organizationId" <> COALESCE(w."organizationId", edition_work."organizationId")
    ) THEN
        RAISE EXCEPTION 'Contribution Agent and target must belong to the same Organization.'
            USING ERRCODE = '23514', CONSTRAINT = 'Contribution_agent_same_organization';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Contribution_agent_same_organization_from_contribution"
    AFTER INSERT OR UPDATE ON "Contribution" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_contribution_agent_organization"();
CREATE CONSTRAINT TRIGGER "Contribution_agent_same_organization_from_agent"
    AFTER INSERT OR UPDATE ON "Agent" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_contribution_agent_organization"();
CREATE CONSTRAINT TRIGGER "Contribution_agent_same_organization_from_work"
    AFTER INSERT OR UPDATE ON "Work" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_contribution_agent_organization"();
CREATE CONSTRAINT TRIGGER "Contribution_agent_same_organization_from_edition"
    AFTER INSERT OR UPDATE ON "Edition" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_contribution_agent_organization"();

CREATE FUNCTION "assert_edition_cover_organization_consistency"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    affected_cover_ids TEXT[];
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'EditionCover' THEN
            affected_cover_ids := ARRAY[NEW."id"];
        WHEN 'CoverAsset' THEN
            SELECT array_agg(ec."id") INTO affected_cover_ids
            FROM "EditionCover" ec WHERE ec."coverAssetId" = NEW."id";
        WHEN 'Edition' THEN
            SELECT array_agg(ec."id") INTO affected_cover_ids
            FROM "EditionCover" ec WHERE ec."editionId" = NEW."id";
        WHEN 'Work' THEN
            SELECT array_agg(ec."id") INTO affected_cover_ids
            FROM "EditionCover" ec
            JOIN "Edition" e ON e."id" = ec."editionId"
            WHERE e."workId" = NEW."id";
        ELSE
            RETURN NULL;
    END CASE;

    IF EXISTS (
        SELECT 1
        FROM "EditionCover" ec
        JOIN "Edition" e ON e."id" = ec."editionId"
        JOIN "Work" w ON w."id" = e."workId"
        JOIN "CoverAsset" ca ON ca."id" = ec."coverAssetId"
        WHERE ec."id" = ANY(affected_cover_ids)
            AND w."organizationId" <> ca."organizationId"
    ) THEN
        RAISE EXCEPTION 'EditionCover Edition and CoverAsset must belong to the same Organization.'
            USING ERRCODE = '23514', CONSTRAINT = 'EditionCover_same_organization';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "EditionCover_same_organization_from_link"
    AFTER INSERT OR UPDATE ON "EditionCover" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_edition_cover_organization_consistency"();
CREATE CONSTRAINT TRIGGER "EditionCover_same_organization_from_asset"
    AFTER INSERT OR UPDATE ON "CoverAsset" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_edition_cover_organization_consistency"();
CREATE CONSTRAINT TRIGGER "EditionCover_same_organization_from_edition"
    AFTER INSERT OR UPDATE ON "Edition" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_edition_cover_organization_consistency"();
CREATE CONSTRAINT TRIGGER "EditionCover_same_organization_from_work"
    AFTER INSERT OR UPDATE ON "Work" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_edition_cover_organization_consistency"();

CREATE FUNCTION "assert_cover_candidate_organization_consistency"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    affected_candidate_ids TEXT[];
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'CoverCandidate' THEN
            affected_candidate_ids := ARRAY[NEW."id"];
        WHEN 'CoverAsset' THEN
            SELECT array_agg(cc."id") INTO affected_candidate_ids
            FROM "CoverCandidate" cc WHERE cc."coverAssetId" = NEW."id";
        WHEN 'BibliographicRecord' THEN
            SELECT array_agg(cc."id") INTO affected_candidate_ids
            FROM "CoverCandidate" cc WHERE cc."bibliographicRecordId" = NEW."id";
        WHEN 'Edition' THEN
            SELECT array_agg(cc."id") INTO affected_candidate_ids
            FROM "CoverCandidate" cc
            JOIN "BibliographicRecord" br ON br."id" = cc."bibliographicRecordId"
            WHERE br."editionId" = NEW."id";
        WHEN 'Work' THEN
            SELECT array_agg(cc."id") INTO affected_candidate_ids
            FROM "CoverCandidate" cc
            JOIN "BibliographicRecord" br ON br."id" = cc."bibliographicRecordId"
            JOIN "Edition" e ON e."id" = br."editionId"
            WHERE e."workId" = NEW."id";
        ELSE
            RETURN NULL;
    END CASE;

    IF EXISTS (
        SELECT 1
        FROM "CoverCandidate" cc
        JOIN "BibliographicRecord" br ON br."id" = cc."bibliographicRecordId"
        JOIN "Edition" e ON e."id" = br."editionId"
        JOIN "Work" w ON w."id" = e."workId"
        JOIN "CoverAsset" ca ON ca."id" = cc."coverAssetId"
        WHERE cc."id" = ANY(affected_candidate_ids)
            AND w."organizationId" <> ca."organizationId"
    ) THEN
        RAISE EXCEPTION 'CoverCandidate record and CoverAsset must belong to the same Organization.'
            USING ERRCODE = '23514', CONSTRAINT = 'CoverCandidate_same_organization';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "CoverCandidate_same_organization_from_candidate"
    AFTER INSERT OR UPDATE ON "CoverCandidate" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_cover_candidate_organization_consistency"();
CREATE CONSTRAINT TRIGGER "CoverCandidate_same_organization_from_asset"
    AFTER INSERT OR UPDATE ON "CoverAsset" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_cover_candidate_organization_consistency"();
CREATE CONSTRAINT TRIGGER "CoverCandidate_same_organization_from_record"
    AFTER INSERT OR UPDATE ON "BibliographicRecord" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_cover_candidate_organization_consistency"();
CREATE CONSTRAINT TRIGGER "CoverCandidate_same_organization_from_edition"
    AFTER INSERT OR UPDATE ON "Edition" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_cover_candidate_organization_consistency"();
CREATE CONSTRAINT TRIGGER "CoverCandidate_same_organization_from_work"
    AFTER INSERT OR UPDATE ON "Work" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "assert_cover_candidate_organization_consistency"();

