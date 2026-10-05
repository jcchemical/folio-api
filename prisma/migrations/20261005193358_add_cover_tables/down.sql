-- Rollback for 20261005193358_add_cover_tables.
-- Drops only the tables introduced by this migration; dependent existing data is untouched.
BEGIN;

DROP TABLE IF EXISTS "EditionCover";
DROP TABLE IF EXISTS "CoverCandidate";
DROP TABLE IF EXISTS "CoverAsset";

COMMIT;
