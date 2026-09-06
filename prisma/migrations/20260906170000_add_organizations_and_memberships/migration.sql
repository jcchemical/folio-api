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

-- AlterTable
ALTER TABLE "Work" ADD COLUMN "organizationId" TEXT;

-- Migrate existing users into deterministic personal organizations.
-- The IDs are derived from User.id so rerunning this SQL cannot create duplicates.
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt")
SELECT
    'org_personal_' || md5(u."id"),
    'Biblioteca de ' || u."email",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT
    'membership_' || md5(u."id" || ':' || ('org_personal_' || md5(u."id"))),
    u."id",
    'org_personal_' || md5(u."id"),
    'OWNER'::"OrganizationRole",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

UPDATE "Work" w
SET "organizationId" = 'org_personal_' || md5(w."userId")
WHERE w."organizationId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key"
ON "OrganizationMembership"("userId", "organizationId");

CREATE INDEX "OrganizationMembership_organizationId_userId_idx"
ON "OrganizationMembership"("organizationId", "userId");

CREATE INDEX "Work_organizationId_createdAt_id_idx"
ON "Work"("organizationId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Work"
ADD CONSTRAINT "Work_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
