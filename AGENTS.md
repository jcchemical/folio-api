# Folio API — agent guidance

## Project context

- Read `CONTEXT.md` before changing application behavior. It is the source of truth for the current API surface, data model, development assumptions, limitations, and planned architecture.
- Treat `CONTEXT.md` as a distinction between implemented behavior and future direction. Do not implement future decisions unless the task explicitly requests them.
- This is a NestJS 12 TypeScript ESM API backed by PostgreSQL and Prisma 7.
- Application code lives in `src/`; Prisma schema and migrations live in `prisma/`.
- The generated Prisma client under `src/generated/prisma/` is build output. Regenerate it with Prisma rather than editing generated files by hand.

## Scope and architecture

- Keep the API as a modular monolith while scale and operational metrics do not justify workers or separate services.
- Keep controllers thin; put business rules in application services/use cases that can be tested without NestJS where practical.
- Organize new functionality by domain capability as the project grows: identity/access, organizations/memberships, cataloguing, provenance, holdings/inventory, circulation, search, import/export jobs, and audit.
- Do not couple the Prisma model directly to UNIMARC, MARC21, MARCXchange, MARCXML, or ISO 2709.
- Use the pipeline `local canonical model → profile mapper → MarcRecord → serializer` for bibliographic export.
- Keep local bibliographic data separate from source provenance and raw records.

## Code conventions

- Preserve ESM imports and include the `.js` extension in local TypeScript imports.
- Keep NestJS features organized by module (`controller`, `service`, and module files together).
- Use `PrismaService` for database access; it is configured with `@prisma/adapter-pg` and a PostgreSQL pool.
- Do not edit generated Prisma files manually.
- Create explicit Prisma migrations for schema changes.
- Keep request validation compatible with the global `ValidationPipe` in `src/main.ts` (`whitelist` and `transform` are enabled).
- Do not add new user-facing hardcoded strings in Flutter; add localization keys.
- Do not translate bibliographic data, MARC values, identifiers, rawContent, names or titles.
- API errors consumed by clients must use stable `code` values; do not make UI logic depend on English exception messages.
- Use plural/select messages for quantities and parameterized messages.
- Treat publicationDate as bibliographic text, not a DateTime for UI formatting.

## Tenancy and authorization

- `Organization` is the sole tenancy boundary for catalogue and inventory data.
- `User` is global; the User–Organization relationship is represented by `OrganizationMembership`.
- Memberships contain the controlled roles `OWNER`, `ADMIN`, `STAFF`, and `READER`.
- `Work.organizationId` and `Item.organizationId` are required.
- `Edition` is authorized through its Work organization.
- Items must be created in the organization of their Edition/Work.
- Never use `userId` as catalogue ownership.
- `userId` identifies the authenticated actor and membership, not the owner of Work, Edition, or Item.
- Never trust `organizationId` from a request body without validating membership and role.
- Reads require membership.
- Catalogue writes require at least `STAFF`.
- Organization administration requires the appropriate organization role.
- Do not create a parallel Institution ownership model.
- Future Library/Branch entities must belong to Organization and must not replace `organizationId` as the tenant boundary.
- Do not implement circulation until holdings, branches, patron roles, loans, and policies are explicitly modelled.
- Organization routes must derive the authenticated user from `request.user.id`; never accept `userId` or ownership fields from request bodies.
- Organization create and rename mutations must be transactional and must map only explicitly allowed fields.
- Organization deletion must remain blocked with `409 Conflict` until Work/Item reassignment is defined safely; never cascade-delete bibliographic data.
- Editions, contributors, identifiers, bibliographic records, items and exports must authorize through their related Work or Item organization.
- `ExternalIdentifier` belongs to the Edition's Work organization; uniqueness is scoped by `(organizationId, type, value)`, not globally.
- Protected controllers must use `JwtAuthGuard` and `request.user.id`.
- Reuse membership checks in `EditionsService`, `ExternalIdentifiersService`, `BibliographicRecordsService`, and `ItemsService` when adding catalogue controllers.

## Authentication and security

- The public authentication contract uses `password`; `User.passwordHash` is storage-only and must never be accepted or exposed through HTTP.
- Passwords are hashed with Argon2id before persistence and verified with Argon2id; update DTOs, storage, tests, Flutter integration, and documentation together when changing the contract.
- The security baseline includes password hashing, short-lived access tokens, rotating/revocable refresh tokens and `/auth/me`. Membership administration, active-organization selection, rate limiting, and audit events remain future work.
- Never log or commit passwords, hashes, access tokens, refresh tokens, secrets, or `.env` files.
- Set `JWT_SECRET` in `.env`; `.env.example` contains the required placeholder.

## Catalogue and PORBASE

- `CataloguesModule` contains external catalogue adapters. Keep PORBASE calls server-side, behind `JwtAuthGuard`, with short timeouts and no automatic Prisma persistence during search or preview.
- The Flutter client must never call PORBASE directly.
- `POST /catalogues/porbase/import-preview` is proposal-only: it must not create or update Work, Edition, Contributor, ExternalIdentifier, BibliographicRecord, or Item rows.
- Keep the import-preview DTO stable and explicit so it can later be reused as input to a separately authorized confirmation endpoint.
- `POST /catalogues/porbase/import` is the confirmation step. It must use one Prisma transaction, the JWT user id, validate organization membership and `STAFF` role, normalize and validate ISBNs, reject duplicate editions within the same organization with `409 Conflict`, and never call PORBASE again.
- Contributor reuse remains conservative: exact case-insensitive matching after whitespace normalization only. There is no authority-control service yet.
- Detect PORBASE responses using Content-Type, leading content, and structure; never assume XML from the endpoint name alone.
- Preserve the provider body exactly in `BibliographicRecord.rawContent`; normalized fields and warnings must not overwrite it.
- Keep the current parser field scope unless expansion is intentional: `001`, `003`, `010$a`, `101$a`, `200$a/f/g`, `210$a/c/d`, `215$a`, `035$a`, `675$3`, `700/701`, `702$4=730`, and `966$s`.
- Normalize and validate ISBNs before calling external providers.
- Use structured warnings for normalization, parsing errors, truncation, missing data, or loss of representation.
- `GET /works` returns the cursor-paginated envelope `{ items, nextCursor, hasMore }`; clients must parse the envelope rather than expect a raw array.

## Bibliographic model rules

- `Edition.pageCount: Int?` is an optional derived convenience field, never the source of truth for UNIMARC `215`.
- `Edition.publicationDate` is a canonical string in `YYYY`, `YYYY-MM` or `YYYY-MM-DD` form; never coerce it through JavaScript `Date`.
- `PhysicalDescription` represents one repeatable `215` field occurrence; `PhysicalDescriptionPart` represents one ordered subfield.
- Preserve occurrence order, part order, repeated codes, repeated fields and unknown lowercase alphanumeric one-character codes.
- Preserve complex descriptions such as `146, [6] p.` as bibliographic text; do not reject them because they are not integers.
- A numeric page count may be derived for filtering or display, but must remain optional and secondary.
- `pageCount` is derived by the backend from grouped `215$a` parts and may be null when ambiguous. It is used only as local-export fallback when no physical descriptions exist.
- Contributors must retain role and order. Do not invent authority codes when a local role cannot be represented safely in the target profile.

## MARC formats and export

- Keep local export independent from `BibliographicRecord.rawContent`.
- Distinguish `local` export from `original` provenance export.
- Priority is UNIMARC, MARCXchange/XML, ISO 2709, MARCXML, then MARC21/other profiles.
- MARCXchange is not MARCXML; implement separate serializers and endpoints.
- `MarcRecord` should preserve profile, syntax, encoding, leader, control fields, data fields, indicators, subfields, repetition, order and warnings.
- Mappers should be able to report `record`, `warnings`, `unmappedFields` and whether output is lossy.
- Keep small single-record exports synchronous. Use jobs for large imports, batch exports, file conversion and other work that may exceed request limits.

## Performance and operations

- Do not introduce microservices, Redis, or an external search engine without measured need.
- Configure PostgreSQL/`pg` pool size and timeouts explicitly for deployment.
- Use stable/cursor pagination, server-side limits, selective Prisma `select` clauses and appropriate indexes before optimizing elsewhere.
- Consider indexes for user/updated lists, edition/work relations, normalized ISBNs, items, contributors, bibliographic source IDs and future loans.
- Keep external PORBASE timeouts short; use bounded retries and caching only when justified by measurements.
- Add structured logs, metrics and tracing before diagnosing scale problems.

## Development commands

Run these from the repository root:

- `npm install` — install dependencies.
- `npm run build` — compile the API.
- `npm run lint` — lint `src/` and `test/` with Oxlint.
- `npm run test` — run unit tests with Vitest.
- `npm run test:e2e` — run end-to-end tests.
- `npx prisma generate` — regenerate the Prisma client after schema changes.
- `npx prisma migrate dev --name <name>` — create and apply a development migration.
- `npx prisma migrate status` — inspect migration history and pending migrations.
- `npx prisma migrate reset` — reset the development database only when explicitly appropriate.
- `npm run start:dev` — start the API in development mode.
- `git diff --check` — check whitespace errors.

Before finishing a change, run the narrowest relevant tests plus `npm run build`; run lint when source formatting or behavior changes. If schema changes, regenerate Prisma and run the relevant migration checks.

## Documentation rules

- Update `CONTEXT.md` when routes, schema, development assumptions, implemented behavior, or architectural decisions change.
- Clearly label future plans as future; do not describe planned features as implemented.
- Keep README focused on setup and execution; keep architecture and domain decisions in `CONTEXT.md`.
- Do not create duplicate documentation files in the repository.

## Current development limitations

- `POST /auth/login` issues JWTs using the `password` contract and Argon2id verification.
- Protected routes currently use the authenticated user's `sub` claim as the user identity. This identity is used to look up OrganizationMembership; it is not used as catalogue ownership.
- Organization, OrganizationMembership, controlled roles, compatibility migration, and self-service organization endpoints are implemented.
- Membership administration, active-organization selection, branch/library models, patrons, holdings, and circulation are not implemented.
- The bibliographic catalogue is a supported subset, not a complete UNIMARC implementation.
- The original-record export endpoint does not yet exist.
- MARCXML, ISO 2709 input/output and MARC21 are future separate implementations.
- `CataloguesModule` exposes the read-only PORBASE search integration and confirmation import; it must not persist search results automatically during search or preview.