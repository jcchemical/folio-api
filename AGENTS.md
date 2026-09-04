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

The bibliographic catalog services are registered by `WorksModule`. Future controllers for editions, contributors, identifiers, bibliographic records, and items should use those services instead of accessing Prisma directly.
