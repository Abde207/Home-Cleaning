# Phase 15A — production configuration and environment foundation

Date: 2026-09-22. Status: **Phase 15A complete for the scoped implementation and local validation gates**. Scope: configuration, secret boundaries and validation only. No production connection, deployment, provider account, API contract, Prisma schema or migration was changed.

## Inspected

- Required design/status/audit/decision/prompt/permission documents. The requested `/mnt/data/Home_Clean_App_Complete_Design_Until_Phase_12A.md` path was absent on this Windows host; the identically named repository-root design was read.
- Complete repository inventory (`rg --files`), package manifests, local `.env` **keys only**, root example/ignore rules, Nest ConfigModule/startup, auth/payment/dispatch/notification worker settings, Prisma config/schema/migration inventory, PostgreSQL/Redis Compose, Admin BFF/session config, Flutter startup/network config, scripts and existing tests.
- No CI workflow or deployment Dockerfile exists. Git has no commits and all project files are untracked, so `git diff` cannot show a historical baseline. Changes were reviewed by file inventory, source inspection and validation instead.

## Implementation and environment architecture

`NODE_ENV` controls Node/Next runtime behavior (`development`, `test`, `production`). `APP_ENVIRONMENT` controls deployment intent (`development`, `test`, `staging`, `production`); staging runs with `NODE_ENV=production`. Mismatched pairs fail. Local development/test may use port 3001 and loopback host by default; staging/production must inject both. Backend and Admin credentials stay server-side. Mobile API URLs are public build-time settings and contain no secrets. Full variable definitions, startup commands and secret custody rules are in [deployment.md](deployment.md).

Backend startup validates the profile, listener, PostgreSQL/Redis URLs, CORS origins, OTP hash/delivery settings, mock payment adapter/webhook secret, dispatch policy and worker flags. The mock webhook secret now has no source-code fallback; existing private local `.env` gained a newly generated value without printing it. Prisma and Nest skip loading the local root `.env` in the production Node runtime. The API listener uses validated `HOST` rather than fixed loopback. The file OTP adapter is rejected outside development/test. Production fails closed because `MockPaymentProvider` is the only implemented adapter; staging can exercise it only as an incomplete test boundary.

Customer and Provider validate `APP_ENVIRONMENT` and an absolute `/api/v1` HTTP(S) URL before app startup or requests. Staging/production require HTTPS; URLs with credentials, query or fragment are rejected. Both apps have public example define profiles. Admin validates its server-only `BACKEND_API_URL` during Node runtime registration and API access. Non-loopback staging/production Admin targets require HTTPS. No `NEXT_PUBLIC_*` credential is used.

Compose remains PostgreSQL 16/Redis 7 for **local development only**, with loopback port publishing, persistent volumes, health checks and local restart behavior. Its project name and existing volumes remain unchanged. Staging/production database, Redis, workers, Admin and API deployment units are deliberately separate future work.

## Variables and secret handling

| Scope | Variables | Handling |
|---|---|---|
| Runtime profile/listener | `NODE_ENV`, `APP_ENVIRONMENT`, `HOST`, `PORT` | Validated; listener defaults only in development/test. |
| Database/cache | `DATABASE_URL`, `REDIS_URL`; local Compose `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Runtime secrets when credentialed; no source values. TLS/hosting policy remains open. |
| API/browser | `CORS_ORIGINS`; Admin `BACKEND_API_URL` | Exact origins/server-only endpoint; HTTPS for staging/production public connections. |
| OTP | `OTP_HASH_SECRET`, `OTP_DELIVERY_MODE`, optional Twilio SID/token/from | Hash secret and provider token are private; file delivery local/test only. Twilio branch is not production-certified. |
| Payment | `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET` | Mock adapter and mock signing secret only; production rejects mock. |
| Dispatch/workers | `DISPATCH_WEIGHTS_JSON`, `DISPATCH_OFFER_SECONDS`, `DISPATCH_MAX_ATTEMPTS`, `DISPATCH_TRAVEL_KPH`, `DISPATCH_LOCATION_MAX_AGE_MINUTES`, `DISPATCH_WORKER_ENABLED`, `NOTIFICATION_WORKER_ENABLED` | Bounded/boolean validation; worker topology remains in-process. |
| Mobile public defines | `APP_ENVIRONMENT`, `API_BASE_URL` | Compiled into Flutter; URLs/profile only, never secrets. |

Root `.env`, Admin `.env.local`, generated mobile `config/*.json`, signing/key files and `.local` state are ignored. Examples contain placeholders or public example hosts. `git check-ignore` confirmed private profile paths are ignored. Secret-pattern review found only the local bootstrap script, which generates a password at runtime; no committed credential was introduced. Because Git has no commits and all files are untracked, a true staged/committed secret scan must be repeated when an initial commit is prepared.

## Files changed

- Root: `.env.example`, `.gitignore`, `compose.yaml`; private ignored `.env` received a random local mock webhook secret and Admin loopback URL.
- Backend: `src/config/environment.ts`, `src/app.module.ts`, `src/main.ts`, `src/auth/otp-sender.ts`, `src/payments/payment.service.ts`, `prisma.config.ts`, `test/unit/foundation.test.mjs`, and a syntax repair in `test/admin-providers.test.ts`.
- Admin: `lib/environment.ts`, `lib/api.ts`, `instrumentation.ts`, `.env.example`, `tests/foundation.test.ts`.
- Flutter: both `lib/core/config/app_config.dart`, both `lib/main.dart`, both `README.md`, both `test/core/config/app_config_test.dart`, and each app's three `config/*.example.json` profiles.
- Tooling: `scripts/init-local.mjs`, `scripts/test-backend.mjs`, `scripts/test-backend-direct.mjs`, `scripts/check-database.mjs`, root `package.json` test script.
- Documentation: `docs/deployment.md`, `docs/codex-implementation-status.md`, `docs/codex-changelog.md`, this report.

## Validation commands and results

| Command | Result |
|---|---|
| `npm.cmd run build:backend` | PASS. |
| `npm.cmd run test:unit` | PASS, 42/42. |
| `.\scripts\prisma-local.ps1 validate` | PASS; existing schema valid. |
| `npm.cmd test` | PASS, 27/27 test files and 73 assertions. Each file received a fresh temporary schema; all seven unchanged Prisma migrations and seed ran for each database-backed file. |
| `npm.cmd run test:database` | PASS, repeatable seed and 16/16 integrity assertions on an isolated schema. The checker applies existing SQL in-process to avoid this Windows host's nested Prisma child-process `EPERM`; `npm.cmd test` separately exercises Prisma migrate deploy. |
| Isolated fresh-schema backend regressions: auth, payments, Phase 11, Admin providers, dispatch, provider job execution | PASS, 6/6 files when run individually with `scripts/test-backend-direct.mjs`; unchanged seven migrations and seed applied to each temporary schema. |
| `flutter analyze --no-pub`, `flutter test --no-pub`, `flutter build apk --debug --no-pub --dart-define-from-file=config/development.example.json` in Customer | PASS; no analyzer issues, 57/57 tests, debug APK built. |
| Same three Flutter commands in Provider | PASS; no analyzer issues, 74/74 tests, debug APK built. |
| `npm.cmd run typecheck -w @home-clean/admin`, `npm.cmd run test -w @home-clean/admin`, `npm.cmd run build:admin` | PASS; typecheck, 16/16 tests, Next production build. |
| `docker compose config --quiet` | PASS; local Compose interpolation valid. |
| `git status`, `git check-ignore`, source secret-pattern scan, migration inventory | Inspected; private files ignored, no migration edited. Git diff is unavailable because repository has no tracked files. |

The first grouped backend direct-runner attempt passed 3/4 files and exposed shared process state in the payments test; payments passed when rerun alone. The previous exact `npm.cmd test` reused one database schema across all suites and failed two cross-suite count assertions; a pre-existing malformed Admin test assertion also prevented transform. The test syntax was repaired and the standard runner now allocates a fresh schema per test file. Final rerun passed 27/27 files. The original `test:database` Prisma child launcher was blocked by `spawnSync node.exe EPERM`; the in-process checker now passes the same seed repeatability and 16 assertions, while the exact Prisma migration runner passes in `npm.cmd test`.

## Known limitations and remaining Phase 15 work

- Real OTP/SMS certification, payment gateway, push, maps/routing and proof storage are absent. No provider credentials or accounts were used. Production backend startup intentionally refuses the mock payment adapter.
- Staging/production PostgreSQL and Redis hosting, TLS/network policy, worker topology and stale notification-claim recovery, Admin multi-instance refresh coordination, domains/HTTPS ingress, CI/CD, secret store, backups/restore, monitoring and signed Android/iOS release pipelines remain open.
- Mobile builds here are Android **debug** artifacts. iOS signing/builds require macOS and approved identities. Local Compose is not a deployment blueprint.
- Git has zero commits, so migration-history and secret checks can confirm the current files but cannot compare them to a committed baseline.

Recommended next subphase: Phase 15B staging platform and secrets/CI foundation, after the documented platform, region, domain, runtime and secret-custody decisions are made. No production deployment is authorized by this report.
