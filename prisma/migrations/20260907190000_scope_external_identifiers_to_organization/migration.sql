-- Scope external identifiers to the organization owning the edition.
-- Existing development rows are backfilled through Edition -> Work -> Organization.

ALTER TABLE "ExternalIdentifier"
ADD COLUMN "organizationId" TEXT;

UPDATE "ExternalIdentifier" AS identifier
SET "organizationId" = work."organizationId"
FROM "Edition" AS edition
JOIN "Work" AS work ON work."id" = edition."workId"
WHERE identifier."editionId" = edition."id";

ALTER TABLE "ExternalIdentifier"
ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX "ExternalIdentifier_type_value_key";

CREATE UNIQUE INDEX "ExternalIdentifier_organizationId_type_value_key"
ON "ExternalIdentifier"("organizationId", "type", "value");

CREATE INDEX "ExternalIdentifier_organizationId_type_value_idx"
ON "ExternalIdentifier"("organizationId", "type", "value");

ALTER TABLE "ExternalIdentifier"
ADD CONSTRAINT "ExternalIdentifier_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
