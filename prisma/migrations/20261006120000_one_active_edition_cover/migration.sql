-- Enforce at most one active cover per Edition. Abort rather than silently
-- changing existing activation choices if historical duplicates are present.
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "EditionCover"
        WHERE "isActive" = true
        GROUP BY "editionId"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add one-active-cover constraint: EditionCover contains Editions with multiple active covers. Resolve those rows explicitly before retrying this migration.';
    END IF;
END $$;

CREATE UNIQUE INDEX "EditionCover_one_active_per_edition_key"
    ON "EditionCover"("editionId")
    WHERE "isActive" = true;

COMMIT;
