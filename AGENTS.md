# Folio API agent guidance

## Project context

- Read `CONTEXT.md` before changing application behavior. It documents the current API surface, data model, development assumptions, and planned work.
- This is a NestJS 12 TypeScript ESM API backed by PostgreSQL and Prisma 7.
- Application code lives in `src/`; Prisma schema and migrations live in `prisma/`.
- The generated Prisma client under `src/generated/prisma/` is build output. Regenerate it with Prisma rather than editing generated files by hand.

## Conventions

- Preserve ESM imports and include the `.js` extension in local TypeScript imports.
- Keep NestJS features organized by module (`controller`, `service`, and module files together).
- Use `PrismaService` for database access; it is configured with `@prisma/adapter-pg` and a PostgreSQL pool.
- Treat `Work` as the intellectual work and `Edition` as its publication-specific child. Keep edition writes scoped to the authenticated user's work.
- Keep `Item.userId` as the ownership boundary; `Item.institutionId` is optional location/management metadata and must be checked against the same user.
- Reuse the ownership checks in `EditionsService`, `ExternalIdentifiersService`, `BibliographicRecordsService`, and `ItemsService` when adding catalog controllers.
- Catalog controllers belong to `WorksModule` and must use `JwtAuthGuard` plus `request.user.id`; never accept `userId` from request bodies.
- `CataloguesModule` contains external catalogue adapters. Keep PORBASE calls server-side, behind `JwtAuthGuard`, with short timeouts and no automatic Prisma persistence.
- `POST /catalogues/porbase/import-preview` is proposal-only: `ImportPreviewService` must call the PORBASE search service and must not create or update Work, Edition, Contributor, ExternalIdentifier, or BibliographicRecord rows.
- Keep the import-preview DTO stable and explicit so it can later be reused as input to a separately authorized confirmation endpoint.
- `POST /catalogues/porbase/import` is the confirmation step after preview. It must use one Prisma transaction, the JWT user id, and never call PORBASE again.
- Confirmation must validate institution ownership, normalize/validate ISBNs, reject duplicate user-owned editions with `409 Conflict`, and preserve rollback semantics.
- Contributor reuse is deliberately conservative: exact case-insensitive matching after whitespace normalization only; there is no authority-control service yet.
- Detect PORBASE responses using Content-Type, leading content, and structure; never assume XML from the endpoint name alone.
- Preserve the limited PORBASE parser field scope unless the integration is intentionally expanded. Current XML/text support covers `001`, `003`, `010$a`, `101$a`, `200$a/f/g`, `210$a/c/d`, `215$a`, `035$a`, `675$3`, `700/701`, `702$4=730`, and `966$s`.
- Validate and normalize ISBNs before calling external providers; never make the Flutter client call PORBASE directly.
- Keep request validation compatible with the global `ValidationPipe` in `src/main.ts` (`whitelist` and `transform` are enabled).
- Update `CONTEXT.md` when routes, schema, development assumptions, or architectural decisions change.
- Do not commit `.env` or other secrets.
- Set `JWT_SECRET` in `.env`; `.env.example` contains the required placeholder.

## Development commands

Run these from the repository root:

- `npm run build` — compile the API.
- `npm run lint` — lint `src/` and `test/` with Oxlint.
- `npm run test` — run unit tests with Vitest.
- `npm run test:e2e` — run end-to-end tests.
- `npx prisma generate` — regenerate the Prisma client after schema changes.
- `npx prisma migrate dev --name <name>` — create and apply a development migration.
- `npx prisma migrate status` — inspect migration history and pending migrations.

Before finishing a change, run the narrowest relevant tests plus `npm run build`; run lint when source formatting or behavior changes.

## Current development limitation

`POST /auth/login` issues JWTs. Protected `institutions` and `works` routes use the authenticated user's `sub` claim as `userId`.

The bibliographic catalog services and controllers are registered by `WorksModule`. `CataloguesModule` exposes the read-only PORBASE search integration; it must not persist search results automatically.
