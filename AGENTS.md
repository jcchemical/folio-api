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