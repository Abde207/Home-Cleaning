# Phase 15 Batch 1  Foundation Report

Work performed 2026-09-22–23. Scope: Phase 15B, 15H and 15I in the repository and local development services. No production deployment, provider connection, real credential, production data migration, Prisma schema change or migration change was made.

## 1. Executive Summary

The batch adds CI validation and a high-confidence credential scan, enforces secure staging/production PostgreSQL and Redis connection URL policy, and closes PostgreSQL worker recovery gaps for notification deliveries and outbox materialization. The API, financial state and dispatch assignments remain PostgreSQL-authoritative. Production startup still rejects the mock-only payment adapter. A live production system remains blocked by unprovisioned infrastructure and provider integrations.

## 2. Phase 15B  Secrets & Security / CI Foundation

Backend startup requires distinct `NODE_ENV`/`APP_ENVIRONMENT` combinations; staging/production receive credentials from their runtime environment, never the ignored local `.env`. Staging/production PostgreSQL URLs must specify a nonlocal host, username/password, `sslmode=require`, and `sslaccept=strict`; Redis must use a nonlocal credentialed `rediss://` URL. Existing OTP and mock webhook secrets retain their Phase 15A length checks and no source fallback. Production still fails because a real payment provider is not implemented. Flutter profiles contain public API URLs only; Admin keeps its backend URL server-only. The code validates URL policy, not whether an endpoint is actually managed or has completed a TLS handshake.

The new `.github/workflows/foundation-ci.yml` runs secret scanning, Compose configuration, Prisma schema validation, backend build/unit/full isolated-schema tests/database integrity, Admin typecheck/tests/build and both Flutter analyzers/tests/debug Android builds. It has no deployment job, production environment, provider account or production credential dependency. CI configuration was reviewed locally; no hosted GitHub Actions run has occurred in this batch.

`scripts/check-secrets.mjs` scans Git-index and nonignored new files in CI for private file paths, private-key blocks, known token/key formats and credentialed URLs. It reports file/line/rule only, never matching values. On this Windows host, Node child creation is denied, so it transparently scans the workspace; a separate Git-index pipe was run to confirm the 514 tracked files. Documented placeholder URLs in localhost and input-validation tests are allowed. This targeted scanner is a guardrail, not a complete historical or entropy-based secret audit. Root `.gitignore` continues to exclude local `.env` files, private mobile profile JSON, keys/signing files, caches and build artifacts. `.env.example` contains local placeholders/public examples only.

Credential custody: Platform/Security owns separate staging and production secret stores, injection identities, access audit and rotation. Backend/Finance owns provider and webhook integration design. Mobile/Release owns signing material. None of the Twilio Verify, Tap Payments, push, maps/routing or object-storage credentials have been provided or used. `docs/deployment.md` records the environment and ownership model.

## 3. Phase 15H  PostgreSQL + Redis

The target is managed PostgreSQL and managed Redis, each isolated by environment and private network. These services were **not provisioned**. Runtime application and migration identities should be separate: the app gets narrow data privileges and a bounded pool, while an approved migration job gets direct/session-capable database access and the required DDL privileges. Prisma schema and the seven existing migrations remain authoritative; use `prisma migrate deploy` in a controlled deployment gate after rehearsal on isolated staging, not at API startup. Do not use development credentials, `migrate dev`, `db push` or production seed operations. Capacity planning must account for all API and worker pools and any compatible pooler.

TLS is required for both services by URL validation. [Prisma ORM v6's PostgreSQL connector](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql) documents `sslaccept=accept_invalid_certs` as its default, so the application requires `sslaccept=strict` in addition to `sslmode=require`. Trust roots/client certificates, network policy and actual certificate verification must be exercised against the eventual managed service. Redis client reconnect is bounded, offline commands are not queued and auth rate-limit failure does not bypass Redis. Redis holds transient rate-limit/coordination data; booking, dispatch, finance, notification and outbox records remain in PostgreSQL. Platform/DBA must select HA, retention, backup/PITR, RPO/RTO and perform a separate-database restore drill with ledger/permission/smoke checks. Redis persistence/failover and monitoring policy must be chosen against the managed service. Local PostgreSQL 16 and Redis 7 Compose definitions were not changed and local connectivity passed.

## 4. Phase 15I  Worker Recovery

Dispatch polls persisted booking/assignment state. BookingService locks a booking row, serializes candidate-team locks, rechecks active offers/capacity and writes offer/history/audit/outbox in one transaction; offer count enforces the configured retry limit. Restarted workers reselect durable state, and replay converges without a second active assignment. Payment webhooks verify signatures and provider event identity before transactional state changes; payment/refund/settlement commands use idempotency keys and transaction locks. There is no separate asynchronous settlement worker. The mock online refund call is currently inside the database transaction and must be redesigned with a real gateway in Batch 2; no real financial call was made here.

Notification outbox rows are now selected with `FOR UPDATE SKIP LOCKED` inside the materialization transaction. Fanout and `processedAt` commit together, and a unique per-user event key protects repeat materialization. Failed materialization increments durable attempts and stops after five; terminal rows remain identifiable by `processedAt IS NULL AND attempts >= 5`. Notification deliveries claim a 120-second lease using the existing `nextAttemptAt` column. Expired `SENDING` attempts are recorded as failed, retried by another worker up to five attempts, and become terminal `FAILED` when exhausted. Conditional completion updates prevent an expired worker from overwriting a newer claim. Errors stored in delivery history and worker logs are generic codes, with IDs/counts for investigation. No schema or migration was needed.

The new isolated `worker-recovery.test.ts` covers interrupted claim recovery, two competing worker instances, one recorded send, attempt history, duplicate sweep suppression, retry exhaustion, redacted provider errors, concurrent outbox claiming and terminal malformed outbox observability. A successful push followed by a process crash before the success commit can still cause a bounded duplicate external send; exactly-once external delivery cannot be claimed without a real provider deduplication/receipt strategy and a send timeout below the lease. The Admin refresh coalescer remains process-local; run one Admin instance until a shared coordination design is implemented and tested. This batch did not invent a distributed session cache.

## 5. Git Baseline & Security Review

At start: `main`, clean working tree, tracking `origin/main`; both `HEAD` and `origin/main` were `96080dfc5d56338f0f54a159d6779138a490ba27` (`chore: initialize Home Clean App repository`). `origin` fetch/push URL was `https://github.com/Abde207/Home-Cleaning.git`. The tracked inventory contained 514 files; the tracked-file secret scan reported no high-confidence credentials/private files. Git ignore checks confirmed the root `.env`, Admin `.env.local` and private mobile production JSON profiles are ignored. No secret/private file was staged. Migration SQL and Prisma schema diffs were empty. Git history was not rewritten.

Final Git status: `main...origin/main` with the intended Batch 1 files modified/untracked and **nothing staged**. A normal staging attempt (`git add --` with the exact intended source/config/test/documentation paths) failed because the sandbox denied creation of `.git/index.lock`; there is no lingering lock or Git process. Repository metadata is read-only in this workspace, so no commit or push could be made. The baseline remains untouched and local changes remain reviewable. Git synchronization is blocked until `.git` write access is available.

## 6. Validation

| Exact command | Result | Relevant output / limitation |
|---|---|---|
| `npm.cmd run build:backend` | PASS | TypeScript backend compiled. |
| `npm.cmd run test:unit` | PASS | 42/42 backend unit assertions, including fail-closed profile checks. |
| `npm.cmd test` | PASS | 28/28 backend test files on independent temporary schemas; standard runner applied unchanged Prisma migrations and seed per database-backed file. |
| `node --env-file=.env scripts/test-worker-recovery-local.mjs` | PASS | Fresh isolated schema, seven SQL migrations and seed; 1/1 focused recovery/concurrency test. In-process fallback avoids this host's Node child-process restriction. |
| `node --env-file=.env scripts/test-backend.mjs worker-recovery.test.ts` | FAIL (tooling) | Node child `tsc` spawn returned `EPERM` before the test; the isolated in-process command above passed. The full standard runner separately completed. |
| `npm.cmd run test:database` | PASS | Fresh isolated schema, repeatable seed and 16/16 database integrity checks. |
| `.\scripts\prisma-local.ps1 validate` | PASS | Prisma schema valid. |
| `.\scripts\prisma-local.ps1 status` | FAIL (tooling) | Prisma schema-engine child process returned `spawn EPERM`; no migration was applied. Fresh-schema migration replay and the standard full runner passed separately. |
| `.\scripts\validate-dispatch-processes.ps1` | PASS | 1/1 separate-process test: convergence, termination recovery, sustained timer retries. |
| `npm.cmd run typecheck -w @home-clean/admin` | PASS | TypeScript reported no errors. |
| `npm.cmd run test -w @home-clean/admin` | PASS | 16/16 tests. |
| `npm.cmd run build:admin` | PASS | Next production build compiled and generated routes. |
| `flutter analyze --no-pub` (Customer) | PASS | No issues found. |
| `flutter test --no-pub` (Customer) | PASS | All Customer tests passed. |
| `flutter build apk --debug --no-pub --dart-define-from-file=config/development.example.json` (Customer) | PASS | Debug APK built. |
| `flutter analyze --no-pub` (Provider) | PASS | No issues found. |
| `flutter test --no-pub` (Provider) | PASS | All Provider tests passed. |
| `flutter build apk --debug --no-pub --dart-define-from-file=config/development.example.json` (Provider) | PASS | Debug APK built. |
| `docker compose config --quiet` | PASS | Local Compose interpolation valid. |
| `docker compose ps --format json` | FAIL (host access) | Docker Desktop API pipe denied access; direct PostgreSQL and Redis connectivity commands below passed. |
| PostgreSQL one-line command below | PASS | Local PostgreSQL connection succeeded without printing URL/credentials. |
| Redis one-line command below | PASS | Local Redis PING succeeded without printing URL/credentials. |
| `npm.cmd run security:scan` | PASS | 588 workspace files checked by fallback, no high-confidence findings. |
| `git ls-files --cached -z \| node scripts/check-secrets.mjs --stdin-nul` | PASS | 514 tracked files checked, no high-confidence findings. |
| `git status --short --branch`, `git diff`, `git diff --check`, `git diff --cached` | PASS (review) | Intended source/config/test/docs changed; no whitespace errors. Cached diff was empty because Git staging was denied. |
| `git check-ignore .env admin/nextjs/.env.local mobile/customer_flutter/config/production.json mobile/provider_flutter/config/production.json` | PASS | All four private profile paths are ignored. |
| `git add -- .gitignore .github/workflows/foundation-ci.yml backend/nestjs/src/config/environment.ts backend/nestjs/src/dispatch/dispatch.worker.ts backend/nestjs/src/notifications/notification.service.ts backend/nestjs/src/notifications/notification.worker.ts backend/nestjs/test/unit/foundation.test.mjs backend/nestjs/test/worker-recovery.test.ts scripts/check-secrets.mjs scripts/test-worker-recovery-local.mjs package.json docs/deployment.md docs/codex-implementation-status.md docs/codex-changelog.md` | FAIL (workspace permission) | `.git/index.lock`: permission denied. Nothing staged or committed; no lock remains. |

The local in-process worker runner initially attempted `node --env-file=.env --import tsx scripts/test-worker-recovery-local.mjs`; the TypeScript loader's esbuild child process returned `spawn EPERM`. It now transpiles the test/seed in process and removes its temporary modules after execution. The hosted GitHub Actions workflow itself has not run, and no production or live-provider validation was performed.

Exact local connectivity commands (both read secrets from the ignored `.env` without emitting values):

```powershell
node --env-file=.env --input-type=module -e "import pg from 'pg'; const c=new pg.Client({connectionString:process.env.DATABASE_URL}); try {await c.connect(); console.log('PostgreSQL connectivity PASS');} catch(e) {console.log('PostgreSQL connectivity FAIL:',e.code||e.name); process.exitCode=1;} finally {await c.end().catch(()=>{});}"
node --env-file=.env --input-type=module -e "import Redis from 'ioredis'; const c=new Redis(process.env.REDIS_URL,{lazyConnect:true,connectTimeout:2000,retryStrategy:()=>null}); try {await c.connect(); await c.ping(); console.log('Redis connectivity PASS');} catch(e) {console.log('Redis connectivity FAIL:',e.code||e.name); process.exitCode=1;} finally {c.disconnect();}"
```

## 7. Files Changed

- Backend: `src/config/environment.ts`, `src/notifications/notification.service.ts`, `src/notifications/notification.worker.ts`, `src/dispatch/dispatch.worker.ts`, `test/unit/foundation.test.mjs`, `test/worker-recovery.test.ts`.
- CI/security/local validation: `.github/workflows/foundation-ci.yml`, `scripts/check-secrets.mjs`, `scripts/test-worker-recovery-local.mjs`, root `.gitignore` and `package.json`.
- Documentation: `docs/deployment.md`, `docs/codex-implementation-status.md`, `docs/codex-changelog.md`, this report.
- Database schema/migrations: **none**. Flutter/Admin source: **none**. Local Compose: **unchanged**.

## 8. Remaining Limitations

- Implementation: external push may be sent twice across the send/commit crash window; provider deduplication/receipt behavior and bounded network timeout are not yet implemented. Outbox terminal replay needs an operator procedure and alerting. Real gateway refund execution needs an asynchronous, durable provider boundary. Admin refresh coordination is process-local.
- Infrastructure: no managed PostgreSQL/Redis, production/staging secret store, private networking, domains/TLS ingress, backup/PITR/restore drill, monitoring/alerts or worker deployment units exist yet.
- Provider: Twilio Verify, Tap Payments, push, maps/routing and object storage remain unconnected and uncertified. The existing Twilio Messages branch is not a Verify integration. The mock payment provider still blocks production startup.
- Credential: no live or sandbox provider/data-service/deployment/signing identities were supplied; none were requested in this batch.
- Deployment: no staging/production deployment, data migration, hosted CI run, release signing or production smoke test occurred.
- Tooling: this Windows host intermittently denies nested Node/Prisma child processes and denies Docker Desktop API-pipe access; direct local DB/Redis connectivity and in-process isolated checks passed. The workspace denies writes to `.git`, preventing normal commits/pushes. Android builds are debug only; iOS requires macOS and signing.

## 9. Credentials Still Required

Types only: Twilio Verify account/sender authorization; Tap Payments sandbox/live merchant API and webhook verification material; push service identity and mobile project/app configuration (plus APNs signing material if iOS is in scope); maps/geocoding/routing API identity; object-storage bucket/workload identity or scoped access key; separate PostgreSQL runtime/migration identities and TLS trust; Redis ACL/password and TLS trust; deployment/registry/DNS/TLS/monitoring/backup identities; CI/CD promotion secrets or workload federation; Android and iOS signing identities. Each must be separately scoped for staging and production where applicable.

## 10. Production Infrastructure Still Required

Provision isolated managed PostgreSQL and Redis, private network access, secret stores, migration job/runner, capacity and connection pooling, automated backups/PITR with verified restore, HTTPS API/Admin ingress and domains, backend/worker/Admin runtime units, central logs/metrics/alerts, provider callback endpoints, object storage, CI promotion controls, and mobile signing/release pipelines. Assign operational owners and recovery targets before launch.

## 11. Recommended Next Step

Resolve the repository metadata write restriction, then create normal Batch 1 commit(s) and push without rewriting the official baseline. After that, Batch 2 implementation can begin locally against abstractions and provider test contracts: 15C Twilio Verify, 15D Tap Payments, 15E Push, 15F Maps and 15G Object Storage. Live certification will require approved provider selections, sandbox credentials, staging infrastructure and owner decisions. Batch 1 does not authorize production deployment.
