-- Preserve the Edition-scoped records while moving ownership to the canonical
-- entity/Organization binding. Legacy columns remain nullable for non-destructive
-- migration; the Prisma model and application no longer read or write them.
ALTER TABLE "ExternalIdentifier"
    ADD COLUMN "entityType" TEXT,
    ADD COLUMN "entityId" TEXT,
    ADD COLUMN "authority" TEXT,
    ADD COLUMN "organizationId" TEXT;

UPDATE "ExternalIdentifier" AS identifier
SET
    "entityType" = 'Edition',
    "entityId" = identifier."editionId",
    "authority" = identifier."type",
    "organizationId" = work."organizationId"
FROM "Edition" AS edition
JOIN "Work" AS work ON work."id" = edition."workId"
WHERE edition."id" = identifier."editionId";

ALTER TABLE "ExternalIdentifier"
    ALTER COLUMN "entityType" SET NOT NULL,
    ALTER COLUMN "entityId" SET NOT NULL,
    ALTER COLUMN "authority" SET NOT NULL,
    ALTER COLUMN "organizationId" SET NOT NULL,
    ALTER COLUMN "type" DROP NOT NULL,
    ALTER COLUMN "editionId" DROP NOT NULL;

ALTER TABLE "ExternalIdentifier"
    DROP CONSTRAINT "ExternalIdentifier_editionId_fkey";

ALTER TABLE "ExternalIdentifier"
    ADD CONSTRAINT "ExternalIdentifier_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ExternalIdentifier_entityType_entityId_authority_value_key"
    ON "ExternalIdentifier"("entityType", "entityId", "authority", "value");

CREATE INDEX "ExternalIdentifier_entityType_entityId_idx"
    ON "ExternalIdentifier"("entityType", "entityId");

CREATE INDEX "ExternalIdentifier_authority_value_idx"
    ON "ExternalIdentifier"("authority", "value");

CREATE INDEX "ExternalIdentifier_organizationId_idx"
    ON "ExternalIdentifier"("organizationId");
