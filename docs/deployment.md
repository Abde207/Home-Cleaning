# Environment configuration and local development

Phase 15A establishes configuration boundaries only. It does not define a production deployment, credentials, provider accounts, or release artifacts. The production readiness gaps and decisions remain in [production-readiness-audit.md](production-readiness-audit.md) and [production-decisions.md](production-decisions.md).

## Environment model

| Profile | Node `NODE_ENV` | `APP_ENVIRONMENT` | Configuration source | External adapters |
|---|---|---|---|---|
| Development | `development` | omitted or `development` | ignored root `.env`, Admin `.env.local`, mobile public Dart defines | file OTP, mock payment/push/geocoder |
| Test | `test` | omitted or `test` | isolated test process and local database schema | test/file and mocks |
| Staging | `production` | `staging` | injected nonproduction runtime secrets; mobile public build defines | live OTP account needed; mock payment is explicitly still incomplete |
| Production | `production` | `production` | separate runtime secret store and public mobile build defines | startup currently fails closed because no real payment adapter exists |

`NODE_ENV` selects Node/Next runtime behavior. `APP_ENVIRONMENT` distinguishes staging from production. Staging and production must use the production Node runtime; a mismatched pair fails validation. Backend and Admin credentials must be injected at runtime. Never copy a local `.env` to staging or production. Flutter Dart defines are compiled into the application and must contain public values only.

## Backend and workers

Root [.env.example](../.env.example) lists current variables. Backend startup validates them before opening a listener. `PORT` (1–65535) and `HOST` default to `3001` and `127.0.0.1` only in development/test; both must be explicit in staging/production. `DATABASE_URL` accepts PostgreSQL URLs and `REDIS_URL` accepts Redis URLs. They are secrets because connection URLs can carry passwords. Their host, TLS, pool, credentials and recovery policy must be chosen for later environments. `CORS_ORIGINS` is an exact comma-separated browser-origin allowlist, with HTTPS required in staging/production.

`OTP_HASH_SECRET` and `PAYMENT_WEBHOOK_SECRET` each require at least 32 characters and have no source-code fallback. `OTP_DELIVERY_MODE=file` is local/test only; Twilio-shaped settings (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) are required if `twilio` is selected. This only validates shape and does not certify the existing Twilio branch. `PAYMENT_PROVIDER=mock` is the only implemented adapter. It may be used for local and incomplete staging exercises; production startup rejects it until a real adapter is implemented. The webhook secret signs the **mock** webhook, not a future gateway.

`DISPATCH_WEIGHTS_JSON`, `DISPATCH_OFFER_SECONDS`, `DISPATCH_MAX_ATTEMPTS`, `DISPATCH_TRAVEL_KPH`, and `DISPATCH_LOCATION_MAX_AGE_MINUTES` use bounded dispatch policy validation and existing local defaults. `DISPATCH_WORKER_ENABLED` and `NOTIFICATION_WORKER_ENABLED` accept `true`/`false`; `false` disables the in-process timer. Worker instances use the same validated backend environment because both currently run in the Nest process. Dedicated worker topology, retries and recovery are later Phase 15 work.

Prisma CLI reads the ignored root `.env` locally; staging/production should inject `DATABASE_URL`. The seven existing migrations and schema were not changed for Phase 15A. Apply migrations through a separately approved deployment gate, not application startup. Never run tests against production: the existing test runners require a local database host and isolated schemas.

## Admin

The Admin server reads `BACKEND_API_URL`, an absolute backend URL ending exactly in `/api/v1`. It must have no embedded credentials, query or fragment. Non-loopback staging/production targets require HTTPS. It is server-only: never prefix it with `NEXT_PUBLIC_`. [Admin example](../admin/nextjs/.env.example) can be copied to ignored `admin/nextjs/.env.local` for standalone development. The Admin server validates configuration at Node runtime registration and on API access. Build/typecheck does not need a live backend or injected runtime URL. `NODE_ENV=production` gives Secure cookies in staging and production; trusted HTTPS ingress and origin policy remain deployment work.

## Customer and Provider Flutter

Each app reads `APP_ENVIRONMENT` and `API_BASE_URL` through Dart defines. The apps validate both at startup: the API URL must be absolute HTTP(S), end in `/api/v1`, and contain no credentials/query/fragment. Staging and production require HTTPS. There is no source-code URL default. Public examples live under each app's `config/*.example.json`. Copy one to an ignored `config/*.json`, replace the example host, and build with `--dart-define-from-file=config/development.json` (or the selected profile). The Android emulator example points to local port 3001; devices/web targets need a reachable host. Never put secrets, provider server keys, or private tokens in Dart defines. Release signing, platform networking, iOS device builds and provider SDK configuration remain later work.

## Local startup and validation

From the repository root, `node scripts/init-local.mjs` creates an ignored private `.env` with random database, OTP and mock-webhook secrets if one does not exist. It never overwrites an existing file. If an older local `.env` lacks `PAYMENT_WEBHOOK_SECRET`, generate a new random value and add it privately. `docker compose up -d postgres redis` runs **local development dependencies only**, binding PostgreSQL 16 to `127.0.0.1:55432` and Redis 7 to `127.0.0.1:56379`. Redis has no auth/TLS and Compose is unsuitable for staging or production. `docker compose config --quiet` validates interpolation. The existing WSL helper remains a local alternative.

Run `npm.cmd run build:backend`, `npm.cmd run test:unit`, `.\scripts\prisma-local.ps1 validate`, `npm.cmd run typecheck -w @home-clean/admin`, and `npm.cmd run build:admin`. With local PostgreSQL/Redis, `npm.cmd test` applies all seven unchanged Prisma migrations and seeds a fresh schema per test file; `npm.cmd run test:database` applies the same SQL directly in an isolated schema, seeds twice and checks 16 integrity assertions. The direct SQL path avoids this Windows host's nested Prisma child-process `EPERM`; it does not replace the normal Prisma migration runner, which `npm.cmd test` exercises. For one focused suite, use `node --env-file=.env scripts/test-backend-direct.mjs <test-file>`. In each Flutter project run `flutter analyze --no-pub`, `flutter test --no-pub`, and `flutter build apk --debug --no-pub --dart-define-from-file=config/development.example.json`. The example files are public templates; production builds need reviewed environment-specific public URLs and release signing.

## Secrets and deployment boundary

Root `.gitignore` excludes `.env*` except examples, local state, mobile private JSON profiles, and common signing/key artifacts. Git ignore is a safeguard, not a secret manager: review `git status`, ignored files and staged diffs before every commit. Store staging/production credentials in an approved environment-specific secret store with scoped access and rotation. Do not commit secrets, real customer data, or production provider configuration. CI/CD, hosted PostgreSQL/Redis, TLS ingress, backups/restore, monitoring, worker topology and all real providers are later Phase 15 work.
