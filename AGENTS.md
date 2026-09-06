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

## Ownership and authorization

- Treat `Work` as the intellectual work and `Edition` as its publication-specific child.
- Until organizations and memberships exist, keep edition writes scoped to the authenticated user's work.
- Keep `Item.userId` as the current ownership boundary; `Item.institutionId` is optional location/management metadata and must be checked against the same user.
- Never accept `userId` from request bodies as an authority.
- Reuse ownership checks in `EditionsService`, `ExternalIdentifiersService`, `BibliographicRecordsService`, and `ItemsService` when adding catalogue controllers.
- Protected controllers must use `JwtAuthGuard` and `request.user.id`.
- Do not implement institutional circulation on top of `Item` flags. Introduce organizations, memberships, branches, patrons, loans and policies before institutional borrowing workflows.

## Authentication and security

- The public authentication contract uses `password`; `User.passwordHash` is storage-only and must never be accepted or exposed through HTTP.
- Passwords are hashed with Argon2id before persistence and verified with Argon2id; update DTOs, storage, tests, Flutter integration, and documentation together when changing the contract.
- The planned security work includes password hashing, short-lived access tokens, rotating/revocable refresh tokens, `/auth/me`, RBAC/memberships, rate limiting, and audit events.
- Never log or commit passwords, hashes, access tokens, refresh tokens, secrets, or `.env` files.
- Set `JWT_SECRET` in `.env`; `.env.example` contains the required placeholder.

## Catalogue and PORBASE

- `CataloguesModule` contains external catalogue adapters. Keep PORBASE calls server-side, behind `JwtAuthGuard`, with short timeouts and no automatic Prisma persistence during search or preview.
- The Flutter client must never call PORBASE directly.
- `POST /catalogues/porbase/import-preview` is proposal-only: it must not create or update Work, Edition, Contributor, ExternalIdentifier, BibliographicRecord, or Item rows.
- Keep the import-preview DTO stable and explicit so it can later be reused as input to a separately authorized confirmation endpoint.
- `POST /catalogues/porbase/import` is the confirmation step. It must use one Prisma transaction, the JWT user id, validate institution ownership, normalize and validate ISBNs, reject duplicate user-owned editions with `409 Conflict`, and never call PORBASE again.
- Contributor reuse remains conservative: exact case-insensitive matching after whitespace normalization only. There is no authority-control service yet.
- Detect PORBASE responses using Content-Type, leading content, and structure; never assume XML from the endpoint name alone.
- Preserve the provider body exactly in `BibliographicRecord.rawContent`; normalized fields and warnings must not overwrite it.
- Keep the current parser field scope unless expansion is intentional: `001`, `003`, `010$a`, `101$a`, `200$a/f/g`, `210$a/c/d`, `215$a`, `035$a`, `675$3`, `700/701`, `702$4=730`, and `966$s`.
- Normalize and validate ISBNs before calling external providers.
- Use structured warnings for normalization, parsing errors, truncation, missing data, or loss of representation.

## Bibliographic model rules

- `Edition.pages: Int?` is not sufficient as the source of truth for UNIMARC `215$a`.
- Preserve complex descriptions such as `146, [6] p.` as bibliographic text; do not reject them because they are not integers.
- A numeric page count may be derived for filtering or display, but must remain optional and secondary.
- Do not remove or rename current fields without a compatibility migration covering parser, DTOs, mapper, API and tests.
- Prefer a future repeatable physical-description structure for `215$a`, `$b`, `$c` and `$d`, preserving subfield, value, order and provenance.
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
- Protected routes currently use the authenticated user's `sub` claim as `userId`.
- Organizations, memberships, roles, branches, patrons and circulation are planned but not complete.
- The bibliographic catalogue is a supported subset, not a complete UNIMARC implementation.
- The original-record export endpoint does not yet exist.
- MARCXML, ISO 2709 input/output and MARC21 are future separate implementations.
- `CataloguesModule` exposes the read-only PORBASE search integration and confirmation import; it must not persist search results automatically during search or preview.