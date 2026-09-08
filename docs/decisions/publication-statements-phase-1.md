# Publication Statements Phase 1

## Context

`Edition` previously stored publication place, publisher and publication date only as scalar fields. That representation cannot preserve repeatable UNIMARC 210 occurrences, repeated subfields, indicators, source order, or literal statements such as `[S.l.]`, `[s.n.]`, and `D.L. 2009`.

## Decision

Add `PublicationStatement` for one 210 occurrence and `PublicationStatementPart` for each ordered subfield. Literal `value` is the bibliographic source of truth. `normalizedValue` is server-derived and read-only. Indicators are preserved; the PORBASE profile defaults missing indicators to `ind1 = " "` and `ind2 = "9"`, explicitly distinct from other profiles' defaults.

When statements are present, `Edition.publicationPlace`, `publisher` and `publicationDate` are projections. Only canonical `YYYY`, `YYYY-MM` or `YYYY-MM-DD` normalized dates populate `publicationDate`; non-canonical literals remain only in the part value. When statements are absent, scalar-only behavior remains unchanged. On update, omitted statements preserve existing rows, an empty list removes rows and clears projections, and a non-empty list replaces rows.

Public write DTOs do not accept `source` or `normalizedValue`. PORBASE import assigns source server-side. Unknown structurally valid lowercase alphanumeric subfields are retained.

Local UNIMARC export uses statements when present and scalar fallback otherwise.

## Alternatives considered

- Keeping only scalar fields loses repeatability and literal fidelity.
- A serialized 210 string makes ordered editing and projections fragile.
- A generic JSON MARC store would weaken relational validation and the existing physical-description pattern.
- Removing scalar write fields immediately would break existing clients and is deferred to Phase 2.

## Consequences

The canonical model is lossless for the supported 210 structure, while legacy scalar-only Editions remain valid and are not backfilled. Reads expose both grouped statements and scalar projections. Preview/import can report normalization and scalar-divergence warnings. Nested persistence and export queries become more involved.

The migration is additive and must be validated against the existing development database without resetting it.

## Phase 2

After clients migrate to grouped statements, remove scalar publication fields from write inputs in a separate breaking change. Database projection columns may remain temporarily for indexing and compatibility; that decision is intentionally deferred.
