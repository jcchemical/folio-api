# Folio App — Agent Guidance

## Project context

- Read `CONTEXT.md` before changing application behavior. It is the source of truth for the current Flutter app, API surface, data model, development assumptions, limitations, and planned architecture.
- Treat `CONTEXT.md` as a distinction between implemented behavior and future direction. Do not implement future decisions unless the task explicitly requests them.
- This is a Flutter/Dart client using Material 3, Riverpod, Dio, go_router and flutter_secure_storage.
- Application code lives in `lib/`; tests live in `test/`; platform-specific configuration lives under `android/`, `ios/`, `web/`, `windows/`, `linux/`, `macos/`.
- The backend lives in the sibling repository `../folio-api`; do not duplicate backend decisions or implementation here.

## Scope and architecture

- The Flutter app communicates exclusively with the Folio API. Never contact PORBASE or other bibliographic sources directly.
- Use `--dart-define=API_BASE_URL=...` for configuration; never hardcode production URLs, tokens or credentials.
- Do not use `dart:io` in shared code. Platform-specific integrations must live behind injectable interfaces and conditional imports.
- Prefer injectable interfaces and local fakes in tests. The UI must not contain bibliographic, authorization or persistence rules.

## Code conventions

- Use Material 3.
- Organize by feature in `lib/features/`.
- Keep cross-cutting code in `lib/core/`.
- Keep pages, state, API and models separate.
- Use Riverpod for state management.
- Use go_router for navigation.
- Use Dio for HTTP.
- Use flutter_secure_storage only for tokens.
- Never log access tokens or credentials.
- Use `--dart-define=API_BASE_URL=...` for configuration.
- Handle loading, error and empty states explicitly.
- Create adaptive widgets; do not duplicate apps for Web and mobile.
- The current authentication provider composition lives in `lib/features/auth/presentation/auth_controller.dart`; maintain a single composition pattern when adding features.

## Bibliographic model and profile mappers

- Treat the persisted Folio bibliographic domain as canonical; do not model Prisma as UNIMARC, MARC 21, MARCXchange, MARCXML or ISO 2709.
- Keep the pipeline `canonical Folio model → profile mapper → MarcRecord → serializer → output format`.
- Keep imports separate: `external payload → parser → MarcRecord → profile import mapper → preview → explicit confirmation → persistence`.
- Preserve literals, order, repetition, indicators and supported unknown parts where applicable; never invent bibliographic values silently.
- Mappers must expose structured warnings, unmapped fields and potentially lossy conversions. Local export uses persisted Folio data, not provider `rawContent`.
- Keep MARCXchange and MARCXML as separate serializers/endpoints. Do not implement organization-level profile selection or automatic profile conversion unless explicitly requested.

## Agents and Contributions

- Do not treat `Agent.displayName` as an authority-controlled preferred form.
- `Agent` is scoped to Organization; validate Agent/target Organization equality in every Contribution write.
- A Contribution targets exactly one Work or Edition; preserve the SQL XOR invariant.
- Never accept client-controlled source, normalized name, 7XX tag, indicators or source parts through public contribution DTOs.
- Trusted PORBASE paths preserve 700/701/702 tags, indicators, source-part order, repeated codes and literal values.
- Do not merge canonical and legacy contribution sets in Phase 1; choose canonical per target only when present.
- Do not infer Work versus Edition scope from a 7XX tag, `$4`, or role text.
- Keep authority control and other 7XX families out of scope unless explicitly requested.

## Internationalization and error codes

- Do not add new user-facing hardcoded strings in Flutter; add localization keys.
- Use generated `AppLocalizations` and ARB files in `lib/l10n/` for every Flutter UI message. The supported product locales are `pt-PT` and `en`; use the supported device locale with `pt-PT` fallback. Do not add a language picker or persisted locale preference unless explicitly requested.
- API errors consumed by clients must use stable `code` values; do not make UI logic depend on English exception messages.
- Parse `{ statusCode, error, code, message, details? }` through the central Flutter API-error helper. Map known codes to feature failure enums, use HTTP status only when code is absent, and never branch on or display API human-readable error messages as the localization contract.
- PORBASE warnings may include stable codes; localize known warning codes while preserving original/normalized bibliographic values verbatim. Unknown or legacy warning codes may use the existing safe fallback.
- Treat publicationDate as bibliographic text, not a DateTime for UI formatting.
- Localize only UI labels around MARC/UNIMARC values; preserve tags, subfield codes and bibliographic values verbatim. Format system event dates/times and numbers with the active locale only when those UI values are introduced.

## Organization and security

- Keep responsibilities separated: `*Api` knows endpoints/payloads, `*Repository` handles persistence and error translation, and controllers/pages coordinate state and presentation.
- Prefer injectable interfaces and local fakes in tests; use `test/features/auth/` as reference for Riverpod, HTTP, persistence and parsing.
- The Flutter app communicates only with the Folio API, never directly with PORBASE.
- Do not expose `passwordHash` in the UI: always present "Palavra-passe".
- Do not persist bibliographic imports without explicit user confirmation.
- Never add tokens, credentials or production URLs to code, logs, tests or version control.

## Backend logging and error handling

- Use NestJS `Logger` for server-side logging; do not add `console.log`, `console.warn` or `console.error` for application diagnostics.
- Route unhandled HTTP errors through the global `ApiExceptionFilter`; preserve the stable `{ statusCode, error, code, message, details? }` contract and do not expose raw exception messages, stacks, Prisma metadata, SQL, filesystem paths or environment values in production.
- Log unhandled server errors with the HTTP method, request path, status, exception name and stack trace. Do not log complete request bodies by default.
- Before logging request context, redact at minimum passwords, tokens, authorization headers, cookies, client secrets and `DATABASE_URL`; use `safe-error-diagnostics.ts` or an equivalent central sanitizer.
- Never log access tokens, refresh tokens, passwords, credentials or secrets, including in tests and temporary debugging code.
- Response diagnostics are opt-in only: `ERROR_DETAILS_IN_RESPONSE=true` is effective only with `NODE_ENV=development`; malformed or missing values and every other environment must remain sanitized.
- Add new error mappings to the central error handling path and preserve existing stable error codes unless a contract change is explicitly approved.

## State and tooling

- Before validating the app, confirm that the Flutter/Dart SDK is available in the environment.
- When the project exists, validate changes with `dart format .`, `flutter analyze` and `flutter test`.
- For explorations without intent to edit, prefer `dart format --output=none --set-exit-if-changed .`.
- After Flutter commands that may regenerate artifacts, check `git status`, especially under `*/flutter/` in platforms.
- If a change alters endpoints, architecture, structure or limitations, update `CONTEXT.md` rather than creating duplicate documentation.

## Before finishing

Run before concluding code changes:

```bash
dart format .
flutter analyze
flutter test
git diff --check
```

Update `CONTEXT.md` if altering:
- endpoints used;
- app structure;
- architecture decisions;
- known limitations.