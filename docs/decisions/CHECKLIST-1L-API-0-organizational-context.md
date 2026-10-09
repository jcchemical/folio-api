# Checklist: 1L-API.0 Organizational Context and Domain Structure

**Status:** Core route groups implemented in code and tests; isolated-database
integration and cross-repository smoke remain open

**Date:** 2026-10-09

**Scope:** `folio-api` schema, migrations, HTTP contracts, authorization, tests and documentation

**Depends on:** `DECISION-1L-DEC-0-organizational-context.md`, `DECISION-1L-DEC-1-organization-library-location.md`, `DECISION-1L-DEC-2-work-edition-holding-item.md`

## 1. Purpose and baseline

This checklist translates the three organizational/domain decisions into one backend implementation plan. The current implementation is a baseline to replace, not a compatibility requirement. The development database may be reset; there are no production data or external consumers to preserve. Do not add compatibility bridges, fallback periods, or migration-safe layering.

The original 2026-10-06 baseline described `Organization → Work → Edition → Item`, lacked `Library`, `Location`, and `Holding`, and had implicit tenant fallbacks. That paragraph is a historical baseline, not the current API state. The Prisma baseline now contains `Organization → Library → Location` and `Organization → Work → Edition → Holding → Item`; Organizations, Works, Editions, Libraries, Locations, Holdings, Items, External Identifiers, Agents and Contributions use explicit root or persisted-resource context. Sections 4.1–4.7 preserve the execution plan and acceptance gates; bullets written in the imperative are not evidence that work remains open when the route matrix or current code marks it implemented.

## 2. Normative target model

Implement these chains and invariants:

```text
User → OrganizationMembership → Organization
Organization → Library → Location
Organization → Work → Edition → Holding → Item
```

- `Organization` remains the sole tenancy boundary. `Library` belongs to exactly one Organization; `Location` belongs to exactly one Library and derives its Organization through Library.
- `Work` belongs to exactly one Organization; `Edition` belongs to exactly one Work.
- `Holding` represents an Organization's possession of an Edition at a Location. It belongs to exactly one Edition and one Location; those relations must resolve to the same Organization. Its Library and Organization are derived, not competing ownership authorities.
- `Item` belongs to exactly one Holding. Do not persist duplicate `organizationId`, `editionId`, `libraryId`, or `locationId` on Item when derivable through Holding. Keep only copy-level attributes on Item.
- Do not introduce `Campus` or `ServicePoint` in this iteration.
- `Agent + Contribution` is the canonical contributor/participation model. Remove the legacy `Contributor`, `WorkContributor`, and `EditionContributor` routes/models and all fallback projections that keep them active, as required by DECISION-1L-DEC-2.
- `ExternalIdentifier` persists its owning Organization and validates it against the canonical target on creation; `entityType`/`entityId` remain polymorphic scalar fields without a target FK. `BibliographicRecord`, `CoverCandidate`, `CoverAsset`, and `EditionCover` derive or constrain their tenant through their canonical target. Do not leave duplicate ownership values that can disagree.
- JWT identifies the user only. Organization context is request context, never a JWT claim or authorization proof.

## 3. Context contract and route classification

### 3.1 Rule

Use `X-Folio-Organization-Id` only for root/ambiguous operations that have no persisted parent/resource from which to derive one Organization. The header is a context selector, not authority: validate existence, current membership and role server-side. Root operations with an explicit Organization return `ORGANIZATION_MEMBERSHIP_REQUIRED` when the user is not a member. For derived Inventory resources and parents, parse supplied header syntax first, then load the resource/parents and resolve membership before comparing the optional header; missing membership is masked as `RESOURCE_NOT_FOUND`. Child creation under a persisted parent derives context from that parent and validates all parent relationships. Never choose an Organization implicitly.

Do **not** require a header merely because an operation creates a scoped row. In particular, child creates derive context from persisted parents.

### 3.2 Existing and target route groups

<!-- prettier-ignore -->
| Route / operation | Context rule | Required implementation outcome |
|---|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` | Global identity/session | No organization context; JWT has no active organization. |
| `POST /users` | Global signup | No request context. Decide whether onboarding creates default Library and Location for the personal Organization; do not invent Campus/ServicePoint. |
| Authenticated `/users` operations | User-self scoped | No organization context; authorize against authenticated user identity. |
| `GET /organizations` | Global-to-user membership listing | Return only Organizations for which the authenticated user has membership; no active-context header. |
| `POST /organizations` | Global authenticated root create | Create Organization and initial OWNER membership without an existing Organization context. Define whether default Library/Location are created here or in onboarding. |
| `GET/PUT/DELETE /organizations/:id` | Persisted Organization identified by path | Derive Organization from path and validate membership/role. If header is supported here, validate equality. The decision text also calls organization-admin operations header-required; resolve this inconsistency before implementation (see §4.1). |
| Root `GET /works` | Explicit root context | Require header and return only Works in that Organization. |
| Root `POST /works` | Explicit root context | Require header; remove body `organizationId`; create Work in resolved Organization. Nested Editions in the same request, if retained, derive from the newly created Work within the same transaction. |
| `GET/PUT/DELETE /works/:id` | Persisted Work | Derive Organization from Work; validate membership/role; reject a supplied mismatching header. |
| Root `GET /editions` | Explicit root context | Require header and filter through Edition → Work → Organization. |
| `POST /editions` | Child create under persisted Work | Derive Organization from `workId`; validate membership/role. Header is not required; if supplied, require it to match the Work. |
| `GET/PUT/DELETE /editions/:id`; `GET /editions/:id/cover`; Edition export | Persisted Edition | Derive Organization through Edition → Work; validate membership/role; reject supplied mismatch. |
| Root `GET /holdings` | Explicit root context | New list route requires header and returns only Holdings in that Organization; Library/Location/Edition filters refine within it. |
| `POST /holdings` | Child create under persisted Edition and Location | Load both parents; require membership in both parent Organizations before checking optional header or same-Organization consistency. Missing membership is `RESOURCE_NOT_FOUND`; once both parents are visible, validate header and same-Organization invariant, then require `STAFF` and create. |
| `GET/PUT/DELETE /holdings/:id` | Persisted Holding | Require membership in both parent Organizations before validating same-Organization consistency; missing membership is `RESOURCE_NOT_FOUND`. For a valid Holding derive its Organization, compare any supplied header, then validate role and perform the operation. |
| Root `GET /items` | Explicit root context | Require header; filter through Item → Holding → Location/Library/Organization. |
| `POST /items` | Child create under persisted Holding | Derive tenant from Holding; do not accept tenant/location/edition ownership as alternate input. Header is optional and must match if present. |
| `GET/PUT/DELETE /items/:id` | Persisted Item | Derive through Holding; validate membership/role; reject supplied mismatch. |
| Current `/libraries` root GET/POST | Explicit root context | Require header; POST has no body `organizationId`. Resource-by-ID derives Organization. |
| Nested Library creation under Organization, if exposed | Child create under persisted Organization | Derive from the Organization parent; if header supplied, require equality. This nested route is not currently exposed. |
| Library/Location root lists | Explicit root context | Require header and restrict results to one Organization. Nested Location creation under Library derives context from the persisted parent. |
| Location creation under Library | Child create under persisted Library | Derive through Library → Organization; if header supplied, require equality. |
| `POST /catalogues/search` | Global external-provider preview | No Organization context; it does not read or persist local tenant data. This is not local catalogue search. |
| `POST /catalogues/import` | Root operation creating local Work/Edition data | **Implemented 2026-10-07:** require header + JWT + STAFF; reject competing tenant ownership and client-supplied bibliographic `source`/`sourceId`/`schema`; create all imported records transactionally in that context. Nested Edition derives from the newly created Work. The server stamps `PORBASE`, but confirmed Contribution tags, indicators and source parts remain client-editable and are not verified against `rawContent` (known provenance limitation). External `POST /catalogues/search` stays global and context-free. |
| Root `/external-identifiers` list | Explicit root context | **Implemented 2026-10-08:** require header; filter by persisted `organizationId`; only `entityType`, `entityId`, and `authority` refine results; use shared cursor pagination. |
| External identifier create | Child binding to one persisted Work, Edition, Library, Location, Holding, or Item | **Implemented 2026-10-08:** derive tenant from canonical target; Holding and Item require both inventory parent paths to resolve to the same Organization; optional header is a consistency check; STAFF+ required. |
| External identifier detail/update/delete | Persisted identifier | **Implemented 2026-10-08:** derive tenant from its persisted Organization; hide missing membership as `RESOURCE_NOT_FOUND`; validate optional header; STAFF+ writes. Entity binding is immutable on update. |
| External identifier cleanup | Direct deletion of Work, Edition, Library, Location, Holding or Item | **Direct-target cleanup implemented 2026-10-09:** each entity `remove` deletes External Identifiers for its own `entityType` + `entityId` in the transaction. This does not clean identifiers of descendants removed by cascades; Work→Edition→Holding→Item and Library→Location cascade paths remain an integrity risk to prove and close against an isolated database. |
| `POST /contributions` | Child association to exactly one persisted Work or Edition | **Implemented 2026-10-07:** derive Organization from target; validate Agent belongs to same Organization; optional header must match; STAFF+ required; source is server-assigned MANUAL. |
| `/agents`, `/agents/:id`, `GET/PATCH/DELETE /contributions` | Root list/create with explicit context; resource routes with derived context | **Implemented 2026-10-09:** Agent CRUD (STAFF+ writes, duplicate and FK-reference conflicts); Contribution list/get/PATCH/DELETE derive Organization from Work/Edition, target and Agent immutable; no schema change. |
| Contribution reads, where exposed | Persisted Work/Edition target | Derive and validate target Organization. |
| `/contributors` legacy routes | Remove | **Implemented:** no Contributor routes/models remain; use canonical `Agent + Contribution`. |
| `GET /bibliographic-records/:id` | Persisted Edition-owned record | **Implemented 2026-10-07:** derive Organization only through `BibliographicRecord → Edition → Work`; optional header must match; require current membership and use stable context/resource errors. This is the only direct Record route; there is no root list or Record-specific write route. Records are created by catalogue import. |
| `GET /editions/:id/cover` / background acquisition | Edition/record-derived | **Implemented 2026-10-07:** read derives Organization from Edition → Work, accepts an optional consistency-only header, validates current membership, and uses stable context/resource errors. Acquisition is internal (no request user/header), derives tenant from Candidate → BibliographicRecord → Edition → Work, and rechecks ownership under Edition/Work lock. Asset remains Organization-scoped for storage/deduplication; deferred baseline triggers enforce Candidate/EditionCover-to-Asset organization equality. Partial unique index permits at most one active EditionCover per Edition. |
| `GET /exports/marcxchange/edition/:editionId` | Persisted Edition | **Implemented 2026-10-07:** derive Organization through Edition → Work; optional header is consistency-only; resolve current membership (Reader+) before loading the export graph; scope the full query to that Organization. Missing and non-member Editions both return `RESOURCE_NOT_FOUND` to avoid a cross-tenant existence oracle; a member's mismatching header returns `ORGANIZATION_CONTEXT_CONFLICT`. Returns the existing MARCXchange XML attachment; no root/batch route or export job. |
| `GET /health`, `GET /`, `/docs` | Global | No organization context. |

### 3.3 Route-contract completion gate

Before coding controllers, enumerate every existing and new route and record method, authentication, context source, required role, and error outcomes. Include Library, Location, Holding and every Item route. No route may remain classified as “all memberships” or “implicit tenant”. Use the target rules above; document any intentional deviation in the decision docs before implementation.

## 4. Work packages and completion criteria

### 4.1 Decision/document contract reconciliation — P0 gate

- Resolve whether `/organizations/:id` administration is path-derived or header-required. The root-ambiguous-only rule favors path-derived context; supplied header must match.
- Clarify whether “local catalogue search” is in scope now; current API has external `POST /catalogues/search`, while no local search endpoint exists. Keep external search global.
- Complete route rules for Library/Location/Holding endpoints and root list routes.
- Decide whether signup creates a default Library and Location for personal Organizations, or whether onboarding does so later.
- Confirm any transition handling for existing seeded data is unnecessary; do not add compatibility layers.

**Done when:** the three decision documents and this checklist agree on these points and identify one final route contract.

### 4.2 Schema and domain model — P0

- Add `Library` and `Location`; enforce Library→Organization and Location→Library cardinality/foreign keys. No Campus or ServicePoint.
- Add `Holding` linked to exactly one Edition and Location; enforce that Edition→Work→Organization equals Location→Library→Organization. Model shared holding data (e.g. call number/collection notes) here, not on Item.
- Change Item to belong to Holding; remove duplicate Item organization/edition/location ownership and move/retire Item `location` according to the approved model.
- Persist `ExternalIdentifier.organizationId` with an Organization `RESTRICT` FK; derive and validate its value from the selected canonical target. **Implemented 2026-10-08:** model and additive migration provide entity/authority/value uniqueness and the requested target, authority/value, and Organization indexes.
- Keep `BibliographicRecord` Edition-owned only; derive tenant through `Edition → Work`, with no duplicate `workId`/`organizationId`. **Implemented:** required Edition FK and `(editionId, createdAt, id)` index are in schema/baseline; no record target XOR is needed because only Edition is supported.
- Keep `BibliographicNote` target XOR between Work and Edition, enforced by the baseline SQL check; derive tenant through its one parent. Current import writes Notes under Edition and there are no public Note routes.
- Keep CoverAsset organization-scoped for storage-key isolation and deduplication; constrain EditionCover asset and Edition to same organization. Ensure CoverCandidate's record/asset path cannot cross tenants. **Implemented in baseline:** deferred triggers enforce these ownership paths; partial unique index protects one active cover per Edition.
- Enforce Agent/Contribution target Organization equality at persistence boundary where feasible; keep Contribution's exactly-one Work-or-Edition invariant.
- Remove Contributor, WorkContributor, EditionContributor from Prisma schema, services, DTOs, output projections, imports, exports/mappers and tests. **Implemented:** baseline/schema and code use only canonical `Agent + Contribution`; no legacy fallback projections remain.
- Re-baseline/rewrite migrations from the final schema; development database reset is allowed. Do not add a compatibility migration chain for old ownership models.

**Done when:** schema expresses the approved chains; no duplicate ownership can disagree; invalid cross-organization parent combinations are rejected by the database or an explicit transaction invariant where a composite constraint is not practical.

### 4.3 API contract and DTOs — P1, after schema agreement

- Add/adjust routes and DTOs for Library, Location and Holding; move Item create/update semantics to Holding ownership.
- Require `X-Folio-Organization-Id` for ambiguous root lists/creates only (notably Work list/create, Edition list, Holding list, Item list, Library/Location root lists and catalogue import confirmation).
- Derive context for child creates from persisted Organization/Library/Work/Edition/Holding parents as applicable; validate cross-parent equality for Holding's Edition and Location.
- Keep resource-specific operations derived from persisted resources; when header is present, compare and fail on mismatch.
- Remove `organizationId` from Work and catalogue-import bodies and remove any redundant tenant fields/params/query inputs. Remove Item's direct Edition target in favor of Holding. **Implemented:** Work/Edition/inventory/import request contracts no longer accept competing tenant ownership.
- Remove tenant authority from External Identifier requests. **Implemented:**
  create accepts a persisted Work, Edition, Library, Location, Holding or Item
  target and derives Organization; update keeps `entityType`/`entityId`
  immutable while allowing `authority` and `value`; list/refinement and raw
  body/query guards enforce the root/derived contract.
- Keep external search, auth, users, health, root and Swagger context-free; classify Organizations routes according to §4.1.
- Update Swagger header parameters, request/response DTOs and examples to match the final route matrix.

**Done when:** each endpoint has one unambiguous context source; no request DTO permits a competing tenant authority.

### 4.4 Context resolution and authorization — P1

- Implement one reusable explicit-context resolver for required root operations: header presence, identifier format, Organization existence, current membership, effective role.
- Implement consistent resource/parent resolvers for Organization, Library, Location, Work, Edition, Holding, Item, ExternalIdentifier, Contribution target, BibliographicRecord, and cover/export ownership. **Implemented for manual Contributions:** shared resolver derives tenant through target and checks optional header before write.
- **Implemented for ExternalIdentifier (2026-10-08):** required root context and entity-derived create/persisted-resource context use the shared `OrganizationContextResolver`; Holding/Item targets validate both Organization paths.
- Enforce optional header equality on resource-derived and child-create operations.
- Keep root explicit-Organization membership failures as `ORGANIZATION_MEMBERSHIP_REQUIRED`; mask missing membership on derived Inventory resources/parents as `RESOURCE_NOT_FOUND` only after validating supplied header syntax.
- For multi-parent Holding creation, require access to both parent Organizations before returning a header or parent-consistency conflict; then validate same-Organization consistency, role, and only then mutate.
- Standardize order: authentication → persisted resource or explicit context resolution → membership → role → domain authorization → operation. **Catalogue import guard resolves required context and STAFF role before payload pipes or persistence.**
- Remove `getDefaultOrganization`, OWNER-first selection, service-level tenant guessing, all-membership aggregation for tenant lists, and post-mutation authorization checks.
- Resolve authorization once before mutation; avoid writing and then re-reading solely to check permission or construct an authorized response.
- Keep the active Organization out of JWT; membership/role is read from current server state.

**Done when:** missing context fails only for root-ambiguous operations; child creates work from persisted parents without a required header; any supplied mismatch fails; no scoped operation crosses organizations.

### 4.5 Error contract — P1

Use one stable machine-readable contract and consistent status mapping for:

- `ORGANIZATION_CONTEXT_REQUIRED`;
- `ORGANIZATION_ID_INVALID`;
- `ORGANIZATION_NOT_FOUND`;
- `ORGANIZATION_MEMBERSHIP_REQUIRED`;
- `ORGANIZATION_ROLE_INSUFFICIENT`;
- `ORGANIZATION_CONTEXT_CONFLICT`;
- `RESOURCE_NOT_FOUND`.

Set/confirm HTTP status semantics once; do not inherit accidental differences from generic Nest exceptions. Keep messages safe and user-oriented. Ensure missing resource is not confused with existing-but-unrelated resource according to the product's disclosure policy.

**Done when:** controllers/services use central error helpers and tests assert both status and code.

### 4.6 Tests — P1

Build shared fixtures with at least two users, two organizations, distinct roles, multiple Libraries/Locations, and Works/Editions/Holdings/Items in both tenants. Replace tests that encode fallback, all-membership lists, legacy Contributor behavior, or duplicate ownership.

**Required coverage:**

- Root list/create/import without header fails with exact status/code; valid member context succeeds; malformed, nonexistent, non-member and insufficient-role contexts fail distinctly.
- Root lists return only the selected Organization, even when caller belongs to both.
- Persisted Inventory resource read/update/delete derives its tenant; member succeeds and non-member is indistinguishable from an absent ID. Header syntax remains distinguishable and a valid member's mismatched header remains `ORGANIZATION_CONTEXT_CONFLICT`.
- Child Edition/Library/Location/Holding/Item creation derives context from persisted parent without header.
- Holding creation returns the same 404/code/message for missing parents and for a caller unable to inspect either parent; an authorized caller sees the Edition/Location Organization conflict. Same-Organization Reader is denied before mutation and STAFF succeeds.
- Optional header matching a derived tenant succeeds; mismatch fails with `ORGANIZATION_CONTEXT_CONFLICT`.
- Cross-tenant reads and writes fail for Work, Edition, Holding, Item, identifiers, Contributions, records, covers and export.
- Cover reads allow any current member role, reject a mismatching optional header before storage reads, and preserve the single-active-cover invariant during acquisition.
- Agent/Contribution and cover/record/Edition relationships cannot cross Organization.
- No fallback chooses an OWNER or personal Organization; no list returns union of memberships.
- Global auth, `/users` self-scoped operations, `GET /organizations`, external catalogue search, health, root and docs do not require organization context.
- Signup/default Library/Location behavior follows the explicit decision from §4.1.
- Legacy Contributor endpoints/data projections are absent; canonical Agent/Contribution import/export paths remain correct.
- Persistence-level tests prove schema constraints and migration baseline matches Prisma schema.

**Done when:** unit and e2e coverage exercises the final two-tenant contract, and no test relies on removed fallback or legacy Contributor semantics.

### 4.7 Documentation and OpenAPI — P2, update with implementation

- Update `CONTEXT.md` with implemented model, routes, context rules, errors and remaining limitations; distinguish implementation from roadmap.
- Update `folio_architecture.md` to remove the old `Work → Edition → Item`, OWNER fallback, and legacy Contributor directions.
- Update `AGENTS.md` with the final tenant/domain rules, route context principles, and canonical Agent/Contribution rule; remove instructions that preserve legacy sets if those are deleted.
- Update Swagger and API examples with new route/DTO contracts.
- Remove wording about compatibility windows, deprecation stages, or old model behavior as an accepted target.

**Done when:** backend docs describe only the final model as implemented and clearly mark anything not yet implemented.

## 5. Acceptance criteria

Implementation against `1L-API.0` can only be closed when:

- Organization→Library→Location and Work→Edition→Holding→Item are implemented with same-Organization invariants;
- no Campus or ServicePoint exists without a new decision;
- root ambiguous list/create operations require explicit context;
- resource operations and child creates derive context from persisted ownership/parents;
- supplied context conflicts fail explicitly;
- there are no implicit tenant fallbacks or all-membership tenant lists;
- Item and other scoped models do not retain contradictory duplicate ownership;
- legacy Contributor paths and fallback projections are removed in favor of Agent+Contribution;
- error codes/statuses are consistent and tested;
- tests prove tenant isolation with two users and two Organizations;
- schema/migrations and docs represent the final model;
- build, lint and API tests pass after implementation.
- persistence constraints, cascade behavior and migrations are exercised
  against an approved isolated database;
- contract/integration tests and cross-repository smoke app→API pass.

Code and local unit tests satisfy most model and route bullets above. The final
two integration gates remain open; this checklist therefore does not declare
the phase complete.

## 6. Explicit non-goals

Do not introduce Campus, ServicePoint, library-level roles, branch tenancy, circulation workflows, loans, reservations, offline sync, global shared bibliographic catalog, or compatibility bridges in this iteration. Decide personal-library default provisioning only as required to define signup/onboarding behavior; do not infer it from current Organization provisioning.
