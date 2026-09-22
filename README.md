# Home Clean

Cleaning marketplace for Amman: Flutter customer/provider applications, NestJS backend, Next.js admin and PostgreSQL/Prisma.

This is an implementation in progress. See [verified status](docs/codex-implementation-status.md), [changelog](docs/codex-changelog.md), and the [master specification](Home_Clean_App_Complete_Design_Until_Phase_12A.md).

## Local foundation

1. Use Node 24.15+ (24.x), npm 11 and Flutter 3.41.9 / Dart 3.11.5.
2. Run `npm ci` at the root.
3. Run `node scripts/init-local.mjs` once to generate a private `.env`. Never commit it.
4. Start PostgreSQL/Redis with `docker compose up -d postgres redis`, or the documented WSL fallback.
5. Build with `npm run build`. Start with `npm run dev:backend` and `npm run dev:admin`.
6. Run `node --env-file=.env scripts/check-foundation.mjs` to check database access and compiled server startup.
7. In each `mobile/*_flutter` directory, run `flutter pub get`, `flutter analyze`, and `flutter build web`.

The current runtime restrictions and exact validation results are recorded in [the continuation validation log](docs/validation-2026-09-19.md). For Windows with installed Prisma engines but no engine download access, use `scripts/prisma-local.ps1 validate` and `scripts/prisma-local.ps1 generate`.

Run `npm run test:unit` for the two existing environment/scope checks without live services. Run `npm test` and `npm run test:database` for the PostgreSQL-backed suites once local services are available. These are separate validation gates.

The current app shells do not expose booking or administrative functions. Database migrations and later domain functionality are tracked separately.
