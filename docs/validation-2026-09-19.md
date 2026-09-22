# Continuation validation — 2026-09-19

## Current checkpoint — 2026-09-21 Phase 9 Payments + Cash final acceptance

| Check | Observed result |
|---|---|
| Backend TypeScript build | PASS `npm.cmd run build:backend` |
| Unit suite | PASS `npm.cmd run test:unit` 37/37 |
| Targeted Dispatch and Booking regression | PASS `node --env-file=.env scripts/test-backend-direct.mjs dispatch.test.ts booking.test.ts booking.lifecycle.test.ts` 3/3; status/capability changes before acceptance, different-key manual callers, audit/history and Booking lifecycle protection |
| Separate-process worker validation | PASS `powershell -File scripts/validate-dispatch-processes.ps1` 1/1; independent Node workers converged, recovered after termination, avoided duplicate work after restart, and sustained timer rejection/expiry/fault recovery |
| Focused Phase 9 live validation | PASS `node --env-file=.env scripts/test-backend-direct.mjs payments.test.ts` 1/1; online initiation/concurrency, verified webhook success/failure/replay/signature/amount checks, retry, cash collection/reconciliation, refund and settlement authorization/idempotency |
| Full backend/live regression | PASS exact `npm.cmd test` 56/56 on final source; Auth/Core/Booking/Dispatch/Pricing/Infrastructure/Phase 9/unit tests on a fresh five-migration seeded PostgreSQL schema with Redis |
| Phase 9 migration | PASS additive `0005_payments_cash_settlement`; configured ledger verified with matching SHA-256 checksum; PaymentAttempt/PaymentStatusHistory/RefundHistory/SettlementHistory, indexes and append-only triggers present |
| Direct Redis check | PASS `PONG` |
| Standard live wrapper variability | Initial targeted attempts blocked before tests by Prisma proxy download refusal or installed-engine `EPERM`; exact full `npm.cmd test` later passed 50/50. An optional targeted wrapper rerun failed before assertions at proxy download again. |
| Database wrapper | Existing `npm.cmd run test:database` nested Node `spawnSync/node.exe EPERM` limitation remains; no application architecture change. |

The direct runner applies the five repository migration SQL files to a disposable local schema, runs the repeatable seed and compiled backend tests, and drops the schema. The Phase 9 live test includes a local signed mock-provider contract; no external gateway credentials were available. The separate-process PowerShell gate starts independent Node workers against that same local PostgreSQL schema and Redis endpoint. Its fault case injects an outbox failure, removes the trigger, and verifies timer recovery. Native Prisma status/deploy and `npm.cmd run test:database` remain blocked before assertions by the existing nested Node `spawnSync node.exe EPERM` limitation. The 500 logs in existing suites are deliberate rollback/readiness fault assertions; the tests verify recovery/safe envelopes.

## Previous checkpoint — 2026-09-20 Phase 8 Dispatch initial backend slice

| Check | Observed result |
|---|---|
| Backend TypeScript build | PASS via `npm.cmd run build:backend` and test prerequisites |
| `npm.cmd run test:unit` | PASS 31/31 after correcting an initial Dispatch unit expectation |
| `npm.cmd test` | PASS 49/49 on final source; each run applied migrations 0001–0004 to a fresh isolated PostgreSQL schema, seeded 5 roles/30 permissions/2 drafts, built and ran all Auth/Core/Booking/Pricing/Infrastructure/Dispatch suites |
| Dispatch live scenario | PASS: policy ranking/audit, scope/price-free projections, same-key replay, targeted worker rejection/expiry retry, three-offer retry limit, manual override/rollback, concurrent distinct-booking capacity, no-team/outbox, late outbox-fault rollback with same-key recovery, and payment separation |
| Configured services | PostgreSQL 16.15 authenticated query; Redis PONG; finished migration ledger 0001–0004 |
| `npm.cmd run test:database` | Attempted once; BLOCKED before assertions by nested `spawnSync node.exe EPERM`, same known wrapper restriction. No Dispatch/database assertion failure observed |

The first full run failed only because the Dispatch expiry fixture tried to set `expiresAt` earlier than `assignedAt`, violating the existing Assignment check constraint. The fixture was corrected to move both times while preserving the constraint; the affected full suite passed on rerun. The initial unit expectation for an out-of-area team with a fresh location was corrected and the unit command passed on rerun. After worker/retry-limit tests were added, one full-suite run reported an isolated auth test-process failure without an assertion trace; the exact rerun passed 49/49. No migration was added or changed. The worker's targeted `runOnce` path is live-validated, but its production timer/multi-instance behavior is not. Phase 8 remains open for legacy manual-route policy, terminal/manual workflow and remaining lifecycle/fault validation. The Phase 7 evidence below is historical and remains valid.

## Previous acceptance — 2026-09-20 Phase 7 configured deployment

| Check | Observed result |
|---|---|
| PostgreSQL / Redis | PostgreSQL 16.15 authenticated query; Redis `PONG` |
| Migration 0004 review / Prisma schema | Additive quote/consumption models and relations match SQL; `scripts/prisma-local.ps1 validate` PASS |
| Native Prisma status/deploy | BLOCKED before database work: installed schema-engine child `spawn EPERM` |
| Controlled versioned migration application | PASS: unchanged 0004 SQL applied in one PostgreSQL transaction to configured public schema after preflight of prior checksums; checksum and successful completion recorded in `_prisma_migrations` |
| Post-migration verification | PASS: 0001–0004 checksums match repository and are finished; both quote/consumption tables, FKs/checks and four Pricing protection triggers present |
| Direct configured database Pricing checks | PASS 7/7: immutable quote/history, expiry constraint, rule/promotion term protection and permitted activation/usage; fixtures rolled back |
| Direct seed, twice | PASS both runs; 5 roles, 30 permissions, 16 existing total service rows including seeded drafts |
| `npm.cmd run test:unit` | PASS 28/28 with fresh backend build |
| `npm.cmd test` | PASS 45/45 after configured migration; fresh isolated four-migration schema, seed, 11 Pricing subtests and Auth/Core/Booking/Infrastructure regressions |
| `npm.cmd run test:database` | BLOCKED before assertions by nested `spawnSync node.exe EPERM`; unchanged 16 integrity assertions passed in prior direct isolated-schema validation |

No application source, Flutter, Dispatch, old migration or checked-in wrapper was changed in this acceptance continuation. Phase 7 Pricing is complete for the scoped backend/database/live gate. Exact database wrapper and native Prisma CLI commands remain an environment limitation. The older checkpoints below document earlier conditions and do not override this result.

## Latest checkpoint — 2026-09-20 Phase 7 rules/promotions/durable quotes

| Validation | Observed result |
|---|---|
| `scripts/prisma-local.ps1 validate` | PASS after correcting the new one-to-one composite unique declarations |
| `scripts/prisma-local.ps1 generate` | PASS; Prisma Client 6.19.3 |
| `npm.cmd run build:backend` / `npm.cmd run test:unit` | PASS; final build and 28/28 units |
| First expanded `npm.cmd test` | PASS 42/42; all four migrations deployed and seed executed in isolated schema |
| Final expanded `npm.cmd test` | BLOCKED before assertions: Prisma binary download ECONNREFUSED; with installed-engine paths, schema-engine spawn EPERM |
| Final direct live/unit acceptance | PASS 45/45, using the same current test source and compiled application modules; includes 11 Pricing acceptance subtests and existing Auth/Core/Booking/Infrastructure regressions |
| Direct database checker assertion body | PASS 16/16 on isolated schema with migrations 0001–0004; seed passed repeatedly (5 roles, 30 permissions, 2 drafts) |
| Redis / PostgreSQL readiness | PASS within current live regression suite |
| `scripts/prisma-local.ps1 status` | BLOCKED before database inspection: installed schema-engine child launch EPERM |
| `npm.cmd run prisma:deploy` | BLOCKED by Prisma download proxy refusal |
| Read-only configured database inspection | 0001–0003 finished with matching repository checksums; PricingQuote/QuoteConsumption absent; 0004 unapplied |
| `npm.cmd run test:database` | Known wrapper limitation retained; not repeatedly rerun; direct assertions above are explicitly separate evidence |

Temporary `.local/phase7-live-validation.mjs` transpiled current test source in-process and ran against a uniquely named local disposable schema. It applied the repository migration SQL transactionally, seeded, ran the unchanged database assertion body, and loaded the existing/new tests with current compiled backend modules. The temporary runner and its schemas were removed after validation. No application or checked-in wrapper was changed. Native Prisma migration status/deploy and final wrapper success are not inferred from direct acceptance.

Concurrency coverage includes simultaneous rule publishing, quote issuance replay, same/different-key quote consumption and last promotion use (explicit and inline quotes). PostgreSQL rejected historical mutations. A late audit insertion failure rolled back all Booking, snapshot/history, promotion, consumption and idempotency writes; same-key retry succeeded. Expected 500/503 logs come from fault/readiness tests.

Historical checkpoint: Phase 7 domain acceptance had passed while configured-database deployment remained outstanding. The current acceptance table at the top supersedes this result; scoped Phase 7 backend acceptance is complete.

This record covers commands actually executed in the continuation session and its 2026-09-20 live-validation addendum. It does not replace or repeat the historical successful results recorded by earlier sessions. Commands ran from the root unless a directory is specified.

## 2026-09-20 current backend continuation

- A focused wrapper check ran a direct `spawnSync(process.execPath, ['-v'])`; it returned `EPERM`, and `npm.cmd run test:database` failed at its Prisma child-process launch before assertions. This confirms an environment/tooling limitation below application behavior; no wrapper bypass or application architecture change was made.
- Pricing foundation was added without schema/migration changes: server-owned `POST /api/v1/bookings/quote`, shared catalog calculation, ownership/scope checks and expiring customer-facing quote output.
- `npm.cmd run build:backend` passed; `npm.cmd run test:unit` passed 24/24; exact `npm.cmd test` passed 29/29, including Phase 5/Auth/Core/Infrastructure/Booking regression suites and quote assertions.
- The standalone Pricing test-file attempt also hit the same Node test-runner spawn restriction. Its assertions were moved into the existing Booking integration suite so the application is validated without changing the wrapper.

## Successful checks

| Command | Observed result |
|---|---|
| `node --version` | v24.15.0 |
| `npm.cmd --version` | 11.12.1 |
| Installed `schema-engine-windows.exe --version` | Engine hash c2990dca591cba766e3b7ef5d9e8a84796e47ab7 matched installed engines-version metadata |
| `npm.cmd run prisma:validate` with explicit installed engine paths | Prisma schema valid |
| `npm.cmd run prisma:generate` with explicit installed engine paths | Generated Prisma Client 6.19.3 |
| `.\scripts\prisma-local.ps1 validate` | PASS; repeated the successful schema command through the new helper |
| `.\scripts\prisma-local.ps1 generate` | PASS; repeated client generation through the helper |
| Backend workspace build, run by `npm.cmd run build` | TypeScript compilation passed before admin build failed |
| `npm.cmd run test:unit` | Fresh backend build passed; 2 tests passed, 0 failed |
| `npm.cmd run typecheck -w @home-clean/admin` | Standalone TypeScript passed; reconfirmed after build attempt |
| `flutter pub get --offline`, each Flutter directory | Dependencies resolved successfully from cache; no upgrade performed |
| `flutter analyze`, each Flutter directory | No issues found |
| `flutter build web --no-pub`, each Flutter directory | Web output built; Wasm dry run succeeded; this is not Android/iOS release validation |
| `node --check scripts/test-backend.mjs` | Syntax passed |
| `node --check backend/nestjs/test/unit/foundation.test.mjs` | Syntax passed |

The helper supplies `PRISMA_SCHEMA_ENGINE_BINARY` and `PRISMA_QUERY_ENGINE_LIBRARY` from installed `node_modules/@prisma/engines` when no caller override exists. This avoids an unnecessary engine download; it does not remove process/service restrictions.

The two unit tests validate environment rejection rules and provider scope helpers. They previously lived inside the auth/infrastructure TypeScript test files. They now use compiled application code in a separate `.mjs` file. They do not validate database-backed authorization, API readiness, transactions or end-to-end behavior.

## Failed or blocked checks

| Command | Actual result / consequence |
|---|---|
| Initial `npm.cmd run prisma:validate` | Attempted engine checksum download; connection refused through configured blocked network proxy. Fixed for validation/generation by selecting installed engines. |
| `.\scripts\start-local.ps1` | WSL returned `Wsl/Service/E_ACCESSDENIED`; no service startup succeeded. |
| `Get-Command docker` discovery | Docker unavailable on PATH; Compose was not executed. |
| `node --env-file=.env scripts/check-foundation.mjs` | PostgreSQL connection refused at 127.0.0.1:55432; HTTP checks never ran. |
| Direct Node/ioredis connection and PING using `.env` | Redis connection/PING unavailable; client disconnected afterward. |
| `npm.cmd run prisma:status` with installed engine paths | Schema engine child-process launch denied: `spawn EPERM`. |
| `npm.cmd run prisma:deploy` with installed engine paths | Same child-process denial; no migration applied. |
| `npm.cmd run prisma:seed` with installed engine paths | Seed child-process launch denied: `spawn EPERM`; seed did not run. |
| `npm.cmd run test:database` | PostgreSQL connection refused; isolated migration/seed/integrity assertions did not run. |
| `npm.cmd test` | PostgreSQL connection refused; no backend integration assertions ran. |
| Filtered Node tests with `--import tsx --test --test-name-pattern='configuration rejects\|provider scopes'` | Child process denied. Retrying with `--test-isolation=none` reached tsx but esbuild child process was also denied. Existing pure tests were then moved to compiled-code `.mjs` tests; `test:unit` passed. |
| `npm.cmd run build` (admin workspace stage) | Next.js compiled, then its TypeScript worker failed with `spawn EPERM`; full admin build not validated. |
| `flutter test`, each Flutter directory | Exit 1: no test files. Do not count empty test suites as passing. |

The runtime does not allow this session to elevate permissions. Restoring WSL and subprocess access requires an environment change. No attempt was made to replace the existing PostgreSQL store, reset migration history or fabricate successful live validation.

## Files changed intentionally

- `package.json`: independent unit-test command.
- `scripts/prisma-local.ps1`: installed-engine helper.
- `scripts/test-backend.mjs`: includes relocated unit checks in the full suite.
- `backend/nestjs/test/infrastructure.test.ts`, `backend/nestjs/test/auth.test.ts`: removed the pure checks now in the unit file.
- `backend/nestjs/test/unit/foundation.test.mjs`: existing checks against compiled application code.
- `README.md`.
- `docs/codex-implementation-status.md`, `docs/codex-changelog.md`, `docs/phase12-changelog.md`, `docs/architecture.md`, `docs/api.md`, `docs/database.md`, `docs/deployment.md`, and this validation record.

Generated Prisma client/backend/admin/Flutter artifacts may have been refreshed by validation. All repository source was already untracked at session start; an empty Git diff would not prove no changes.

## Resume order

1. Restore local WSL/PostgreSQL/Redis and required child-process access.
2. Run existing startup script, migration status/deploy, seed twice and inspect the actual configured database, including migration checksums, FK/index/check/trigger catalog and seeded rows.
3. Run `npm run test:database`, `npm test`, full admin build and foundation HTTP smoke. Fix and rerun any failures.
4. Finish engineering Phase 5 Core Domain service boundaries and missing database-backed tests. Continue to booking/pricing only after that phase passes.

Current status: Phase 12A validation **BLOCKED**; backend database integration already **IMPLEMENTED**; Phase 5 Core Domain partially **IMPLEMENTED**. No whole-project percentage is claimed without an agreed measurable denominator.

## Phase 5 Core Domain continuation — latest results

This addendum supersedes the earlier resume order for implementation work. The latest user instruction explicitly permits independent Core Domain development while infrastructure remains blocked. Earlier successful Phase 12A schema/client, admin TypeScript and Flutter dependency/analyzer/web checks were preserved and not repeated.

| Command | Result |
|---|---|
| `npm.cmd run test:unit` | PASS: fresh backend TypeScript build and 21 tests, 0 failures. Includes 19 new Core Domain tests and two existing foundation checks. |
| `node --check backend/nestjs/test/core.test.ts` | PASS: expanded live test syntax; no live assertions executed by this command. |
| `node --check backend/nestjs/test/unit/core.test.mjs` | PASS: independent test syntax. |
| `npm.cmd test` | BLOCKED, exit 1: `ECONNREFUSED 127.0.0.1:55432`. Retried after expanding the integration cases; runner never reached migrations or HTTP/database assertions. |
| `npm.cmd run test:database` | BLOCKED: same PostgreSQL connection refusal; no integrity assertions executed. |
| Direct Node/ioredis connection/PING using the existing `.env` | BLOCKED, exit 1: Redis connection/PING unavailable. Client disconnected after the attempt; no secrets printed. |
| Core controller source scan for `PrismaService` / `this.db` | No matches: database access now resides in services. |

The unit suite validates DTO handling, permissions/scopes, ownership query predicates, response selections, pagination, UTC input rules, transaction call ordering and error propagation using test doubles. It does not establish real persistence, atomic rollback, concurrent locking, server HTTP authorization or session invalidation. Those are covered by implemented but BLOCKED tests in `backend/nestjs/test/core.test.ts`.

No schema/migration/seed/dependency change was made. No migration or seed was rerun against the unavailable database. WSL E_ACCESSDENIED and Prisma subprocess EPERM remain earlier known restrictions; neither was retested in this Core Domain continuation. No successful check from Phase 12A or the clients is newly claimed.

Files, API/security decisions and the remaining acceptance gate are recorded in [phase5-core-domain.md](phase5-core-domain.md). Current Phase: **engineering Phase 5 — Core Domain; live acceptance BLOCKED**. Exact next step: restore the existing PostgreSQL/Redis and permitted subprocess environment, complete outstanding live foundation checks, then execute the expanded database/backend tests and fix any failures before moving to booking implementation.

Final source review: `node node_modules/typescript/bin/tsc -p backend/nestjs/tsconfig.json --noEmit` passed after import cleanup. No additional business-code changes followed the 21-test pass.

## 2026-09-20 — Infrastructure recovery attempt

| Command/check | Result |
|---|---|
| `Get-Content scripts/start-local.ps1` then `& .\scripts\start-local.ps1` | **BLOCKED**: WSL `Wsl/Service/E_ACCESSDENIED`; no services started. |
| `wsl.exe --status`, `wsl.exe -l -v` | **BLOCKED**: WSL distro enumeration denied. |
| `Get-Command docker/psql/redis-cli` and Windows service/process checks | **BLOCKED**: Docker, psql, redis-cli, PostgreSQL/Redis services and processes absent. |
| TCP checks `127.0.0.1:55432` and `127.0.0.1:56379` | **BLOCKED**: both refused/unavailable. |
| `npm.cmd run prisma:status/deploy/seed` | **BLOCKED**: Prisma engine download refused through configured proxy `127.0.0.1:9`. |
| `.\scripts\prisma-local.ps1 status/deploy/seed` | **BLOCKED**: installed engine selected, then schema/seed child-process launch denied with `spawn EPERM`. |
| `.\scripts\prisma-local.ps1 validate` | **PASS**: schema valid. |
| `.\scripts\prisma-local.ps1 generate` | **PASS**: Prisma Client 6.19.3 generated. |
| `npm.cmd run build:backend` | **PASS**: TypeScript compilation. |
| `npm.cmd run test:unit` | **PASS**: 21 tests, 0 failures. |
| `npm.cmd test` / `npm.cmd run test:database` | **BLOCKED**: PostgreSQL connection refused before assertions. |

No database mutation occurred during this attempt. Phase 5 live acceptance remains blocked and no Bookings work was started.

## 2026-09-20 — Live Phase 5 validation addendum

The configured PostgreSQL and Redis services were available without restarting the project. TCP connectivity to both ports, an authenticated PostgreSQL query, Redis PING and a temporary Redis set/get check passed.

### Migration and seed evidence

The exact Prisma commands were attempted again. `prisma migrate status` and `prisma migrate deploy` using `scripts/prisma-local.ps1` reached the installed schema engine but failed before database work with `spawn EPERM`. The normal seed command attempted the blocked Prisma proxy download; the installed-engine seed path failed to spawn `tsx`. These are runtime wrapper failures, not migration SQL failures.

To validate the database state without changing migration history, the unchanged SQL from `0001_init`, `0002_integrity` and `0003_session_rotation` was applied transactionally to the configured database and each SHA-256 checksum was recorded in `_prisma_migrations`. The direct seed script then passed twice: 5 roles, 30 permissions, 32 role grants and 2 inactive services. No migration file was edited, reset or deleted.

### Live checks

| Command/check | Result |
|---|---|
| `npm.cmd run test:unit` | PASS: fresh backend build and 21 tests, 0 failures |
| Direct database integrity runner | PASS: 16 assertions covering seed repeatability, ownership, constraints, snapshots, assignment overlap, append-only history and payable balance |
| Direct Redis check | PASS: `PING=PONG` and temporary set/get |
| Compiled live backend suite on isolated schema | PASS: 3/3 tests — OTP/auth, full Core Domain HTTP/database acceptance, and infrastructure readiness |
| `npm.cmd run test:database` (rerun) | BLOCKED before assertions: `spawnSync C:\\Program Files\\nodejs\\node.exe EPERM` |
| `npm.cmd test` (rerun) | BLOCKED before assertions: Prisma engine-download proxy refusal / nested Prisma process failure |

The Core Domain live suite exercised customer/provider isolation, admin and dispatcher permissions, pagination, parent-child validation, catalog extras, company areas/profile projections, concurrent provisioning, cleaner availability/scope, capability rollback/concurrency, audit-FK rollback, snapshot preservation, deactivation filtering, suspension/session revocation and role/member revocation. All passed. Temporary validation schemas were removed after the checks.

Current result: **Phase 5 live acceptance PASS; exact npm/Prisma wrapper gate BLOCKED by the execution environment.** The wrapper limitation does not invalidate the underlying checks and does not require rebuilding Phase 5. Current development has since advanced through live-validated Booking lifecycle boundaries to the Pricing backend foundation.

## 2026-09-20 — Booking backend validation addendum

- Existing Booking/history/payment/idempotency tables were reused; no migration or dependency change was required. No existing Booking application behavior was duplicated because none existed before this phase.
- Backend build passed after adding `BookingModule`, DTOs, projections, state-machine rules, service, controller and routes.
- `npm.cmd run test:unit` passed **22/22**, including Booking transition checks.
- A fresh isolated migrated/seeded schema ran the compiled live suite at **4/4**: existing authentication, existing Core Domain, infrastructure readiness and Booking acceptance.
- Booking acceptance passed customer ownership/IDOR protection, concurrent same-key creation without duplicate rows, required idempotency and replay/mismatch behavior, backend-generated booking data, historical address/property/service/extra snapshots, extra-price preservation, explicit `REQUESTED → PRICE_CONFIRMED → CASH_SELECTED` commands, separate cash Payment intent, status history, audit records, cancellation and invalid transition rejection.
- The exact `npm.cmd test` / `npm.cmd run test:database` wrappers remain blocked before assertions by the environment's nested Node/Prisma `spawn EPERM`; this is documented as a wrapper limitation, not a Booking implementation failure.

Historical checkpoint: **Engineering Phase 6 — Booking backend initial slice.** The remaining work listed there was completed in the later Booking continuation; current development is Phase 7 Pricing foundation.

## 2026-09-20 — Booking lifecycle continuation addendum

- Added and validated Booking-side boundaries without changing or rebuilding migrations: append-only quote handoff validation, online/cash payment confirmation, manual assignment handoff, provider assignment/job commands, rejection/retry, team/customer no-shows, completion-proof metadata, cash collection, reconciliation, completion and refunds.
- New lifecycle validation passed concurrently idempotent assignment calls, authorization boundaries, state/history/event/audit writes, exact cash amount checks, proof-gated completion and refund terminal behavior.
- The Booking checkpoint passed `npm.cmd run test:unit` **22/22** and exact `npm.cmd test` **27/27**, including Auth, original Booking, new Booking lifecycle, Core Domain and Infrastructure regression suites. The current Pricing checkpoint passes **24/24** units and **29/29** exact backend tests.
- `npm.cmd run test:database` remains blocked before assertions by nested Prisma `spawnSync node.exe EPERM`. This is an environment wrapper limitation and is distinct from the passing compiled live application suite and direct database/Redis checks.

Historical checkpoint: **Engineering Phase 6 — Booking backend; lifecycle boundaries implemented and live-validated, dependency integration incomplete.** The current phase is Engineering Phase 7 — Pricing backend foundation. Flutter, full Pricing, separate Dispatch and full Payments remain out of scope.
