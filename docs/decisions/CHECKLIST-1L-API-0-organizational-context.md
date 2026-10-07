# Checklist: 1L-API.0 Organizational Context and Domain Structure

**Status:** Partially implemented; remaining route groups continue under the approved target model

**Date:** 2026-10-07

**Scope:** `folio-api` schema, migrations, HTTP contracts, authorization, tests and documentation

**Depends on:** `DECISION-1L-DEC-0-organizational-context.md`, `DECISION-1L-DEC-1-organization-library-location.md`, `DECISION-1L-DEC-2-work-edition-holding-item.md`

## 1. Purpose and baseline

This checklist translates the three organizational/domain decisions into one backend implementation plan. The current implementation is a baseline to replace, not a compatibility requirement. The development database may be reset; there are no production data or external consumers to preserve. Do not add compatibility bridges, fallback periods, or migration-safe layering.

The original 2026-10-06 baseline described `Organization → Work → Edition → Item`, lacked `Library`, `Location`, and `Holding`, and had implicit tenant fallbacks. That paragraph is a historical baseline, not the current API state. As of 2026-10-07, the Prisma baseline contains `Organization → Library → Location` and `Organization → Work → Edition → Holding → Item`; Organizations, Works, Editions, Libraries, Locations, Holdings, and Items use explicit root or persisted-parent context. Remaining groups and legacy models below are not implied complete by this physical-inventory slice.

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
- `ExternalIdentifier`, `BibliographicRecord`, `CoverCandidate`, `CoverAsset`, and `EditionCover` must derive or constrain their tenant through their canonical target. Do not leave duplicate ownership values that can disagree.
- JWT identifies the user only. Organization context is request context, never a JWT claim or authorization proof.

## 3. Context contract and route classification

### 3.1 Rule

Use `X-Folio-Organization-Id` only for root/ambiguous operations that have no persisted parent/resource from which to derive one Organization. The header is a context selector, not authority: validate existence, current membership and role server-side. Persisted-resource operations derive context from persisted ownership. Child creation under a persisted parent derives context from that parent and validates all parent relationships. If a header is also supplied for a resource-derived operation, it must match the derived Organization or fail with the context-conflict code. Never choose an Organization implicitly.

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
| `POST /holdings` | Child create under persisted Edition and Location | Resolve both parents and require same Organization; derive the Holding's tenant. Header is not required; if supplied, it must match both parents. |
| `GET/PUT/DELETE /holdings/:id` | Persisted Holding | Derive Organization through its persisted parent chain; validate membership/role; reject supplied mismatch. |
| Root `GET /items` | Explicit root context | Require header; filter through Item → Holding → Location/Library/Organization. |
| `POST /items` | Child create under persisted Holding | Derive tenant from Holding; do not accept tenant/location/edition ownership as alternate input. Header is optional and must match if present. |
| `GET/PUT/DELETE /items/:id` | Persisted Item | Derive through Holding; validate membership/role; reject supplied mismatch. |
| Current `/libraries` root GET/POST | Explicit root context | Require header; POST has no body `organizationId`. Resource-by-ID derives Organization. |
| Nested Library creation under Organization, if exposed | Child create under persisted Organization | Derive from the Organization parent; if header supplied, require equality. This nested route is not currently exposed. |
| Library/Location root lists | Explicit root context | Require header and restrict results to one Organization. Nested Location creation under Library derives context from the persisted parent. |
| Location creation under Library | Child create under persisted Library | Derive through Library → Organization; if header supplied, require equality. |
| `POST /catalogues/search` | Global external-provider preview | No Organization context; it does not read or persist local tenant data. This is not local catalogue search. |
| `POST /catalogues/import` | Root operation creating local Work/Edition data | **Implemented 2026-10-07:** require header + JWT + STAFF; reject competing tenant ownership and client-supplied bibliographic `source`/`sourceId`/`schema`; create all imported records transactionally in that context. Nested Edition derives from the newly created Work. The server stamps `PORBASE`, but confirmed Contribution tags, indicators and source parts remain client-editable and are not verified against `rawContent` (known provenance limitation). External `POST /catalogues/search` stays global and context-free. |
| Root `/external-identifiers` list | Explicit root context | **Implemented 2026-10-07:** require header; filter by `Edition → Work → Organization`; optional `editionId` only refines within the selected tenant. |
| External identifier create under an Edition | Child create under persisted Edition | **Implemented 2026-10-07:** derive tenant through Edition → Work; no header required, validate it if supplied; STAFF+ write role. |
| External identifier detail/update/delete | Persisted identifier | **Implemented 2026-10-07:** derive tenant through persisted identifier → Edition → Work; validate membership/role and optional header equality. Update does not reassign Edition. |
| `POST /contributions` | Child association to exactly one persisted Work or Edition | **Implemented 2026-10-07:** derive Organization from target; validate Agent belongs to same Organization; optional header must match; STAFF+ required; source is server-assigned MANUAL. |
| Contribution reads, where exposed | Persisted Work/Edition target | Derive and validate target Organization. |
| `/contributors` legacy routes | Remove | **Implemented:** no Contributor routes/models remain; use canonical `Agent + Contribution`. |
| `GET /bibliographic-records/:id` | Persisted record target | Resolve one unambiguous Work/Edition owner and derive Organization; inconsistent or ownerless local records must not authorize via only one of multiple targets. |
| Cover read/acquisition | Edition/record-derived | Derive tenant through Edition/Work or the unambiguous BibliographicRecord target; constrain CoverAsset/EditionCover to the same Organization. Background acquisition does not use a request header. |
| `GET /exports/marcxchange/edition/:editionId` | Persisted Edition | Derive Organization through Edition → Work and validate membership. |
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
- Remove `ExternalIdentifier.organizationId` if tenant is derivable from Edition; set uniqueness/indexes at the canonical scope.
- Make BibliographicRecord's ownership unambiguous (Work or Edition target, or an explicitly modeled external-import record); prevent conflicting Work/Edition targets and derive tenant consistently.
- Keep CoverAsset organization-scoped only if required for dedup/storage policy; constrain EditionCover asset and Edition to same organization. Ensure CoverCandidate's record/asset path cannot cross tenants.
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
- Remove tenant authority from External Identifier requests; `organizationId` is derived through Edition → Work and is not persisted on the model. **Implemented:** create requires persisted `editionId`; update changes only identifier fields; list/refinement and raw body/query guards enforce the root/derived contract.
- Keep external search, auth, users, health, root and Swagger context-free; classify Organizations routes according to §4.1.
- Update Swagger header parameters, request/response DTOs and examples to match the final route matrix.

**Done when:** each endpoint has one unambiguous context source; no request DTO permits a competing tenant authority.

### 4.4 Context resolution and authorization — P1

- Implement one reusable explicit-context resolver for required root operations: header presence, identifier format, Organization existence, current membership, effective role.
- Implement consistent resource/parent resolvers for Organization, Library, Location, Work, Edition, Holding, Item, ExternalIdentifier, Contribution target, BibliographicRecord, and cover/export ownership. **Implemented for manual Contributions:** shared resolver derives tenant through target and checks optional header before write.
- **Implemented for ExternalIdentifier:** required root context, persisted-Edition child context, and persisted-identifier context all use the shared `OrganizationContextResolver`.
- Enforce optional header equality on resource-derived and child-create operations.
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
- Persisted-resource read/update/delete derives its tenant; member succeeds and non-member fails.
- Child Edition/Library/Location/Holding/Item creation derives context from persisted parent without header.
- Holding creation rejects Edition and Location from different Organizations (including different Library within same/different Organization as specified).
- Optional header matching a derived tenant succeeds; mismatch fails with `ORGANIZATION_CONTEXT_CONFLICT`.
- Cross-tenant reads and writes fail for Work, Edition, Holding, Item, identifiers, Contributions, records, covers and export.
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

`1L-API.0` is complete when:

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

## 6. Explicit non-goals

Do not introduce Campus, ServicePoint, library-level roles, branch tenancy, circulation workflows, loans, reservations, offline sync, global shared bibliographic catalog, or compatibility bridges in this iteration. Decide personal-library default provisioning only as required to define signup/onboarding behavior; do not infer it from current Organization provisioning.
