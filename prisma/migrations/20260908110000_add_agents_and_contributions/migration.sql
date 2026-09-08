-- Add the canonical, organization-scoped contribution model.
-- Legacy Contributor, WorkContributor and EditionContributor rows are retained
-- unchanged and deliberately are not backfilled.

CREATE TYPE "AgentKind" AS ENUM ('PERSON', 'CORPORATE_BODY', 'UNKNOWN');
CREATE TYPE "ContributionSource" AS ENUM ('PORBASE', 'MANUAL');

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

CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workId" TEXT,
    "editionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roleLabel" TEXT,
    "relationshipCodeScheme" TEXT,
    "source" "ContributionSource" NOT NULL,
    "sourceTag" CHAR(3),
    "indicator1" CHAR(1),
    "indicator2" CHAR(1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Contribution_exactly_one_target"
      CHECK (("workId" IS NOT NULL AND "editionId" IS NULL)
          OR ("workId" IS NULL AND "editionId" IS NOT NULL))
);

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

CREATE INDEX "Agent_organizationId_kind_normalizedDisplayName_idx"
ON "Agent"("organizationId", "kind", "normalizedDisplayName");
CREATE INDEX "Agent_organizationId_displayName_idx" ON "Agent"("organizationId", "displayName");
CREATE INDEX "Contribution_workId_sortOrder_id_idx" ON "Contribution"("workId", "sortOrder", "id");
CREATE INDEX "Contribution_editionId_sortOrder_id_idx" ON "Contribution"("editionId", "sortOrder", "id");
CREATE INDEX "Contribution_agentId_idx" ON "Contribution"("agentId");
CREATE INDEX "ContributionSourcePart_contributionId_sortOrder_id_idx"
ON "ContributionSourcePart"("contributionId", "sortOrder", "id");

ALTER TABLE "Agent" ADD CONSTRAINT "Agent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_workId_fkey"
FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_editionId_fkey"
FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContributionSourcePart" ADD CONSTRAINT "ContributionSourcePart_contributionId_fkey"
FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;