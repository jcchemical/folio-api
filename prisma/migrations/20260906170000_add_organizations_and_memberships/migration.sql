-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'READER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
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

-- Backfill the required tenant columns before making them non-null.
ALTER TABLE "Work" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Item" ADD COLUMN "organizationId" TEXT;

-- IDs derive from User.id, making the backfill deterministic.
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt")
SELECT 'org_personal_' || md5(u."id"), 'Biblioteca de ' || u."email", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT 'membership_' || md5(u."id" || ':' || ('org_personal_' || md5(u."id"))), u."id", 'org_personal_' || md5(u."id"), 'OWNER'::"OrganizationRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

UPDATE "Work" w
SET "organizationId" = 'org_personal_' || md5(w."userId");

UPDATE "Item" i
SET "organizationId" = w."organizationId"
FROM "Edition" e
JOIN "Work" w ON w."id" = e."workId"
WHERE i."editionId" = e."id";

ALTER TABLE "Work" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Item" ALTER COLUMN "organizationId" SET NOT NULL;

-- Remove the legacy indexes and constraints before retiring their columns/table.
DROP INDEX "Institution_userId_createdAt_id_idx";
DROP INDEX "Item_userId_createdAt_id_idx";
DROP INDEX "Item_institutionId_status_createdAt_id_idx";
DROP INDEX "Work_userId_createdAt_id_idx";
DROP INDEX "Work_institutionId_createdAt_id_idx";
ALTER TABLE "Work" DROP CONSTRAINT "Work_userId_fkey";
ALTER TABLE "Work" DROP CONSTRAINT "Work_institutionId_fkey";
ALTER TABLE "Item" DROP CONSTRAINT "Item_userId_fkey";
ALTER TABLE "Item" DROP CONSTRAINT "Item_institutionId_fkey";
ALTER TABLE "Work" DROP COLUMN "userId", DROP COLUMN "institutionId";
ALTER TABLE "Item" DROP COLUMN "userId", DROP COLUMN "institutionId";
DROP TABLE "Institution";

CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");
CREATE INDEX "OrganizationMembership_organizationId_userId_idx" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "Work_organizationId_createdAt_id_idx" ON "Work"("organizationId", "createdAt", "id");
CREATE INDEX "Item_organizationId_status_createdAt_id_idx" ON "Item"("organizationId", "status", "createdAt", "id");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Work" ADD CONSTRAINT "Work_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
