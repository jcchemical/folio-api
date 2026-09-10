ALTER TABLE "Organization"
ADD COLUMN "defaultCatalogueSource" TEXT DEFAULT 'porbase',
ADD COLUMN "enabledCatalogueSources" TEXT[] NOT NULL DEFAULT ARRAY['porbase']::TEXT[];

UPDATE "Organization"
SET "defaultCatalogueSource" = 'porbase'
WHERE "defaultCatalogueSource" IS NULL;