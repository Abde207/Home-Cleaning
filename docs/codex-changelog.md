# Home Clean implementation changelog

## 2026-09-23 — Phase 15 Batch 2 external-services continuation

- Continued from the existing checkpoint without reverting or duplicating its Twilio, Tap, FCM/APNs, tracking, storage, mobile checkout, configuration or documentation work.
- Added bounded Twilio/Tap retry behavior, Tap attempt/booking callback validation, precise FCM error/token handling and payload bounds, injected geocoder/routing providers, reassignment-safe tracking freshness, Customer live-location/ETA display, expiring private-object read capabilities and safe deletion.
- Removed the obsolete completion-proof gate from final Booking completion while retaining optional historical metadata. No schema or migration changed.
- Expanded fake-adapter, payment-reference, tracking-reassignment, Customer UI, object authorization/tamper/expiry/deletion and refund retry coverage. No real provider operation or production deployment occurred. Exact results and open provider decisions are in [Batch 2 report](phase15-batch2-external-services-report.md).

## 2026-09-22 — Phase 15 Batch 1 foundation

- Added CI validation for backend, Prisma, isolated database regressions, Admin and both Flutter apps; added a secret/private-file scan and environment separation documentation. Staging/production runtime now requires nonlocal credentialed PostgreSQL with verified TLS and nonlocal credentialed Redis over TLS. Production still rejects the mock payment adapter.
- Kept PostgreSQL as the worker source of truth. Notification claims now use bounded leases and recover after interruption; outbox selection is transactional and failed materialization attempts are counted with a retry cap. Worker logs and delivery records use generic failure codes. Added a focused isolated recovery/concurrency test and documented the unavoidable external push ambiguity after a crash between send and commit.
- No database schema, migration, API contract, mobile app behavior, Admin behavior, external provider connection or production deployment changed. Exact local validation and environment limitations are in [Batch 1 report](phase15-batch1-foundation-report.md).

## 2026-09-22 — Phase 15A production configuration foundation

- Audited Backend, Admin, both Flutter apps, workers, Prisma/PostgreSQL, Redis, local Compose, scripts and CI presence. Added explicit development/test/staging/production configuration boundaries and validation, with local defaults confined to development/test.
- Removed the mock payment webhook source fallback; added startup checks, Admin server-only URL checks, Flutter public profile examples, stronger Git ignores, and local-only Compose documentation. Corrected a pre-existing syntax error in one Admin regression test. No schema, migration or API contract changed.
- Backend build, 42/42 units, 27/27 full isolated test files (73 assertions), database integrity 16/16, Prisma validation, Admin typecheck/16 tests/build, Customer 57 tests/analyze/debug APK, Provider 74 tests/analyze/debug APK, and local Compose validation passed. The standard full test runner now isolates schemas per file; the database checker runs unchanged migrations and repeatable seed in-process to avoid the host's child-process `EPERM`. Exact commands and remaining limitations are in [Phase 15A report](phase15a-production-configuration-report.md). Production integration, provider accounts, CI/CD and deployment are not part of 15A.

## 2026-09-21 — Phase 11 Notifications + Location final acceptance (complete)

- Added LocationModule address validation/default/geocoding and team location reporting while preserving immutable Booking snapshots and the existing Dispatch scoring/area/freshness behavior.
- Added NotificationModule event-keyed notification history, device ownership/invalidation, mock push delivery, retry/failed handling, append-only delivery attempts and outbox worker processing. Booking, Dispatch, Payment/Cash/Refund and Settlement authoritative transitions now emit notification handoffs.
- Added additive migration `0007_phase11_notifications_location`; migrations `0001`–`0006` remain unchanged. Prisma validation/client generation and backend build passed. Focused Phase 11 unit checks passed 3/3, expanded units 40/40, and compiled live PostgreSQL acceptance passed 1/1 with Redis PONG.
- External maps/push credentials, production routing/delivery adapters, Flutter UI and deployment remain intentionally unimplemented. Exact next phase: Engineering Phase 12 — Customer Application; it was not started automatically.

## 2026-09-21 — Phase 9 Payments + Cash final acceptance (complete)

- Added the additive `0005_payments_cash_settlement` migration with PaymentAttempt, PaymentStatusHistory, RefundHistory, SettlementHistory, verified webhook metadata, cash collector company/team attribution and Settlement versioning. Migrations 0001–0004 were preserved; the configured ledger now contains all five matching checksums.
- Added PaymentModule with the provider abstraction/local mock adapter, online initiation/retry, HMAC-verified idempotent webhooks, provider/reference/amount/currency checks, scoped payment reads, server-side refunds and settlement commands. Strengthened existing Booking cash/refund commands with collection attribution, transactions, history/audit and aggregate over-refund protection. Dispatch behavior was not changed.
- Focused unit tests passed 37/37; focused compiled live PostgreSQL payment/cash/refund/settlement acceptance passed 1/1; exact full backend regression passed 56/56 with fresh five-migration PostgreSQL schema, repeatable seed and Redis. Direct PostgreSQL inspection and Redis PONG passed.
- No real gateway credentials or sandbox were available, so external provider behavior remains intentionally abstract/mock. `npm.cmd run test:database` remains blocked before assertions by the known nested Node `spawnSync node.exe EPERM` wrapper limitation. Exact next phase: Engineering Phase 10 — Settlements.

## 2026-09-21 — Phase 8 Dispatch final acceptance (complete)

- Routed legacy `/bookings/:id/assign` through Dispatch manual policy and Booking's transactional offer writer. It now requires `dispatch:manage`, an idempotency key and a nonblank reason; it validates the stored slot, eligibility and capacity, and returns the narrow operational projection. Removed the old direct Booking assignment writer.
- Defined explicit 409 boundaries for terminal `NO_TEAM_AVAILABLE` and accepted/on-the-way/started manual reassignment. No Booking transition was added to the master graph. Pending-offer replacement records the actor's reason in the cancelled assignment, event, status history and audit; new offer audit also records the reason.
- Added live assertions for team status and capability changes before acceptance, different-key manual assignment races, audit/history consistency, and explicit state protection. Added a separate-process worker gate covering convergence, termination/recovery, restart deduplication, sustained timer rejection/expiry retry and fault recovery. Targeted Dispatch/Booking passed 3/3, unit tests passed 32/32, separate-process validation passed 1/1, and exact full live/backend passed 50/50 with fresh PostgreSQL schemas and Redis.
- Phase 8 Dispatch is complete for the scoped backend acceptance. Native Prisma status/deploy and `npm.cmd run test:database` retain the known nested Node `spawnSync node.exe EPERM` limitation; the direct/compiled path and exact full backend regression passed. Next implementation phase: Engineering Phase 9 — Payments + Cash.

## 2026-09-20 — Phase 8 Dispatch initial backend slice (in progress)

- Read the master dispatch specification and inspected the existing Booking/Prisma assignment boundary. Reused Assignment, AssignmentEvent, DispatchAttempt, TeamAvailability, CompanyServiceArea and TeamServiceCapability; no schema migration or second assignment model.
- Added DispatchModule with deterministic eligible-team discovery, configurable weighted scoring, approximate straight-line ETA, reliability/performance factors, ranked/audited decision snapshots, provider-scoped offer reads and dispatcher monitoring. Automatic and reasoned manual offers use BookingService's existing idempotent, row-locked state/history/assignment boundary.
- Added expired-offer handling on follow-up dispatch, next-team retry after rejection, retry limit/no-team result, and pending-offer manual reassignment/area-availability override. Booking acceptance now rejects expired/non-operational offers; common offer creation serializes by team and rechecks capacity. Legacy privileged assignment remains for compatibility and requires policy hardening before phase acceptance.
- Added a PostgreSQL-polling DispatchWorker for payment-ready/rejected/expired bookings, using an internal actorless Booking command with null-actor audit/history and row-lock convergence. Assignment/no-team decisions now write OutboxEvent handoffs in the same transaction. Targeted worker retry, expiry, replay convergence and three-offer exhaustion passed live; the production timer/multi-instance recovery and outbox delivery are not yet validated.
- Added Dispatch unit/live tests for policy, scope, audit, provider projection, expiry/rejection retry, manual override/rollback, concurrent same-key replay, competing bookings/capacity, retry exhaustion and no-team outcome. A late outbox fault proved the full offer/history/attempt/idempotency transaction rolls back and the same key can retry. First unit expectation and expiry fixture failures were corrected; final `npm.cmd run test:unit` passed 31/31 and `npm.cmd test` passed 49/49 with migrations 0001–0004, seed and all regressions.
- Configured PostgreSQL 16.15, Redis PONG and finished migration ledger 0001–0004 verified. Exact `npm.cmd run test:database` again failed before assertions with nested Node `spawnSync node.exe EPERM`; this remains tooling-only. A later full-suite run reported an isolated auth test-process failure without an assertion trace, then the exact rerun passed 49/49. Dispatch remains **open** for legacy route/manual policy, production timer/multi-instance and remaining lifecycle/fault validation. No Flutter or Phase 9 work began.

## 2026-09-20 — Phase 7 configured migration deployment and acceptance

- Verified PostgreSQL 16.15 and Redis PONG. Prisma schema validation passed, and migration 0004 was compared with the current Prisma models/relations.
- Existing Prisma helper status/deploy failed before database work with schema-engine child `spawn EPERM`; Docker API access was denied. Applied the unchanged versioned 0004 SQL transactionally to the configured local public schema after validating existing 0001–0003 checksums and absent target objects, then recorded the 0004 checksum and success in `_prisma_migrations`. No previous migration was edited/reset/deleted.
- Verified all four ledger checksums/finished markers, PricingQuote/QuoteConsumption tables, FKs/checks and four Pricing history/terms triggers. Seven configured database Pricing checks passed with all fixtures rolled back. Direct seed ran twice successfully; current database contains 5 roles, 30 permissions and 16 total services (including seeded drafts).
- Exact `npm.cmd test` passed 45/45 after configured deployment, including 11 Pricing subtests and Auth/Core/Booking/Infrastructure regressions. `npm.cmd run test:unit` passed 28/28 with a fresh backend build. Existing 16 database integrity assertions had passed on an isolated migrated schema at the prior checkpoint.
- Exact `npm.cmd run test:database` still fails before assertions with nested Node `spawnSync node.exe EPERM`; native Prisma status/deploy wrappers remain environment-blocked. These are tracked separately from successful migration deployment and Pricing acceptance.
- Engineering Phase 7 Pricing is complete for the scoped backend gate. Engineering Phase 8 Dispatch is next and was not started. Flutter was not changed.

## 2026-09-20 — Phase 7 rules, promotions and durable quote handoff

- Reused existing PricingRule/Promotion/catalog models. Added validated declarative rules, increasing versions, effective windows, scoped filters, Decimal rounding/bounds and audited/idempotent publication/activation APIs. Defined rule precedence and percentage basis explicitly in phase7-pricing.md.
- Added fixed-amount promotions using existing minimum/window/capacity columns. Discounts cap at subtotal; consumption locks the promotion and increments uses once in the Booking transaction.
- Added immutable PricingQuote and QuoteConsumption through additive migration 0004; composite owner FKs and unique consumption prevent reuse/foreign handoff. Published rule/promotion terms are protected against edits/deletes.
- Booking accepts an owned quoteId and copies historical quoted source/extra/price data. Existing no-quote callers invoke the same evaluator transactionally, preventing rule bypass. State machine and payment ownership are unchanged. Bounded hashed audit request IDs support full-length Booking creation idempotency keys.
- Final validation: schema validation/client generation/build passed; units 28/28; direct live/unit suite 45/45 (11 Pricing subtests plus prior suites); existing database integrity assertions 16/16 and repeated seed passed. Late audit fault injection proves rollback of Booking/usage/consumption/history/idempotency and safe retry.
- Earlier exact npm test passed 42/42, including Prisma deployment of 0004 to a disposable schema. Final wrapper reruns were blocked before assertions by Prisma download refusal/installed-engine spawn EPERM. A temporary in-process validation runner executed unchanged migrations/tests/assertions and was removed afterward; application/npm wrappers were not modified.
- Configured public database still contains 0001–0003 with matching SHA-256 checksums. Status/deploy attempts were blocked by runtime tooling, so 0004 is NOT claimed deployed there. No old migration was edited/reset/deleted.
- Phase 7 remains open for deployment/native-tool verification. Dispatch, Payments/Settlements and Flutter were not started.

## 2026-09-20 — Phase 7 Pricing backend foundation

- Inspected the master Pricing specification and existing Core/Booking contracts; reused the existing `PricingRule`, `Promotion` and `BookingPriceSnapshot` schema without adding or resetting migrations.
- Added `POST /api/v1/bookings/quote` with customer-derived ownership, active catalog/property/address validation, transaction-stable source reads, generated quote expiry and a customer-facing formula breakdown.
- Extracted the catalog calculation shared by quote responses and Booking creation. The current `catalog-v1` boundary intentionally has zero adjustments, fees and discounts; no provider payout/commission data is exposed.
- Added deterministic Pricing unit coverage and expanded the existing Booking live integration suite for scoped, ephemeral quotes. Backend build passed, unit tests passed 24/24, and exact `npm.cmd test` passed 29/29 with all Phase 5/Auth/Core/Infrastructure/Booking regressions green.
- One standalone test-file attempt reproduced the runtime's Node test-runner `spawn EPERM`; assertions were kept in the existing suite. The focused `spawnSync(process.execPath, ['-v'])` check also returned `EPERM`, confirming that `npm.cmd run test:database` remains an environment wrapper limitation before assertions.
- Current phase is engineering Phase 7 — Pricing backend foundation. Versioned rules, promotions, durable quote persistence and direct quote-to-booking handoff remain next; Flutter, separate Dispatch and full Payments remain out of scope.

## 2026-09-20 — Phase 6 Booking lifecycle continuation

- Inspected the existing Booking slice and reused its state machine, historical snapshots, authorization helpers, audit path, locks and advisory-key idempotency; no existing behavior was rebuilt and no migration was added/reset/deleted.
- Added DTOs, commands and routes for server-owned quote handoff, online/cash payment confirmation, manual assignment handoff, assignment acceptance/rejection/retry, job transitions, completion proofs, team/customer no-shows, cash collection, payment reconciliation, proof-gated completion and trusted refund completion.
- Quote handoff validates the server-owned append-only `BookingPriceSnapshot` instead of mutating history. Financial records remain separate across Payment, PaymentEvent, PaymentTransaction, CashCollection and Refund.
- Added live lifecycle coverage for concurrent assignment replay, authorization, online/cash flows, rejection/retry, both no-show paths, proof, reconciliation, completion, refund and terminal states.
- VALIDATED: backend build; `npm.cmd run test:unit` 22/22; latest `npm.cmd test` 27/27; original Booking regression; and the new lifecycle suite. `npm.cmd run test:database` remains blocked before assertions by nested Prisma `spawnSync node.exe EPERM`, documented as an environment wrapper limitation.
- Current phase remains Engineering Phase 6 — Booking. Full Pricing, separate Dispatch, full Payments/gateway work and Flutter remain out of scope.

## 2026-09-20 — Phase 6 Booking backend initial slice

- Read the master booking/state-machine and implementation-order requirements, the latest Phase 5 records, and the existing Core Domain implementation. Confirmed Booking tables existed but no Booking application module, routes, commands or tests existed.
- Added a dedicated BookingModule/BookingService with scoped customer/operational reads, backend-generated booking numbers, active-catalog validation, customer ownership checks, historical address/property/service/extra snapshots and a `catalog-v1` quote snapshot boundary.
- Added explicit `ConfirmBooking`, `SelectCashPayment` and `CancelBooking` commands. No arbitrary booking status PATCH was added. Cash selection creates a separate `Payment` cash-intent record; collection/reconciliation and online payment remain deferred.
- Added the complete documented Booking transition graph, row-locking, Booking version increments, status history, transactional audit records and PostgreSQL advisory-lock idempotency with replay/mismatch protection.
- Added Booking DTOs, explicit projections, API routes and integration/unit tests. No migration or dependency change was needed; the existing Booking/history/payment/idempotency schema was reused.
- VALIDATED: backend build, `npm.cmd run test:unit` with 22 passing tests, and a fresh 4/4 compiled live suite covering auth, Core Domain, infrastructure and Booking acceptance. Booking tests passed ownership isolation, concurrent same-key creation without duplicates, idempotency, snapshots, extra-price preservation, explicit transitions, cash/payment separation, cancellation, audit/history and invalid transition behavior.
- The exact `npm.cmd test` / `npm.cmd run test:database` failures remain documented as environment-only nested Node/Prisma `spawn EPERM`; they do not negate the passing underlying compiled live/database/Redis/seed checks.
- Current phase is engineering Phase 6 — Booking backend. Pricing, Dispatch, online Payments, Flutter and provider job workflows were not started.

## 2026-09-20 — Phase 5 live acceptance

- Confirmed PostgreSQL and Redis were already healthy on the configured local ports; direct authenticated PostgreSQL query, Redis PING and temporary set/get passed.
- Applied the unchanged `0001_init`, `0002_integrity` and `0003_session_rotation` migration SQL transactionally to the configured database and recorded SHA-256 checksums in `_prisma_migrations`. No migration was reset, deleted or edited.
- Ran the seed script twice directly; both runs passed with 5 roles, 30 permissions, 32 role grants and 2 inactive catalog drafts.
- Direct database integrity validation passed 16 assertions covering ownership FKs, checks, immutable snapshots/history, assignment uniqueness/overlap, rating bounds and balanced payables.
- Compiled live backend acceptance passed 3/3: OTP/authentication, the expanded Core Domain HTTP/database suite, and infrastructure readiness. Core Domain ownership, permissions, pagination, provisioning, cleaner scope, rollback, concurrency, snapshots, suspension and role revocation all executed against an isolated migrated/seeded schema.
- `npm.cmd run test:unit` passed with a fresh backend build and 21 tests. Exact `npm.cmd run test:database` and `npm.cmd test` were rerun but remain blocked before assertions by `spawnSync node.exe EPERM` and Prisma's blocked engine-download/child-process path.
- Phase 5 live acceptance is PASS, but the project remains in Phase 5. No Bookings or Pricing work was started.

## 2026-09-20 — Infrastructure recovery and Phase 5 gate

- Read the current implementation status/changelog and attempted the existing local recovery path before any new domain work.
- Reproduced WSL `E_ACCESSDENIED`; Docker and native Windows PostgreSQL/Redis installations are unavailable, and both configured TCP ports refuse connections.
- Normal Prisma status/deploy/seed scripts are blocked by the configured proxy's engine-download refusal. The installed-engine helper reaches Prisma but child-process execution remains `spawn EPERM`.
- Validated installed-engine Prisma schema/client, backend compilation, and the existing 21-test unit suite. Live Phase 5 HTTP/database acceptance did not run because PostgreSQL was unavailable.
- No schema, migration, seed, dependency, booking, pricing, Flutter or admin source changes were made. Phase 5 remains the current phase and is not passed.

## 2026-09-19 — Phase 5 Core Domain continuation

- Preserved the current repository, database integration, schema/migrations and completed Phase 12A checks. No Flutter, booking-engine or pricing-engine work.
- Extracted user/catalog/company/team persistence into application services. Added admin customer reads, company provider profile, extras/area updates, team metadata/schedule management and identity-role revocation.
- Completed role/resource scope checks, cleaner own-team availability, dispatcher operational reads, explicit response projections and bounded list pagination.
- Added transactional audits and row locks for privileged updates; serialized duplicate identity provisioning and replace-all team capabilities. Role revocation also deactivates membership and revokes sessions.
- VALIDATED: backend TypeScript build, 21 independent tests (19 new Core Domain checks), test syntax checks.
- IMPLEMENTED, NOT LIVE VALIDATED: expanded HTTP/database tests for ownership, rollback, concurrency, snapshots and revocation. BLOCKED: PostgreSQL refused 127.0.0.1:55432; Redis connect/PING unavailable; database and integration runners never reached assertions.
- Database/dependencies: no schema, migration, seed, package or lockfile changes. API changes and exact file list: [Phase 5 record](phase5-core-domain.md) and [API contract](api.md).
- Remaining/next: restore existing services/runtime access, execute live foundation and Core Domain acceptance tests, fix failures, record results. Remain in Phase 5 until it passes.

## 2026-09-19 — Continuation: validate existing foundation and restore accurate status

- Inspected the existing implementation instead of recreating the foundation. PrismaService/DatabaseModule, configuration, lifecycle, readiness, auth and partial core APIs already exist. The continuation instructions are in `notepad codex-continue.md`.
- Fixed local Prisma validation/generation setup with `scripts/prisma-local.ps1`, using installed Windows engines while preserving explicit overrides and restoring the caller's environment.
- Moved the two existing pure environment/scope tests into `test/unit/foundation.test.mjs`; added root `test:unit` with a backend build and Node runner without process isolation. Full integration runner still includes both unit checks. No application business logic or migration was changed.
- VALIDATED now: Prisma schema/client generation, backend build, two unit checks, admin standalone TypeScript, dependency resolution/analyzers/web builds for both Flutter shells.
- BLOCKED now: WSL startup (`E_ACCESSDENIED`), PostgreSQL connection/Redis PING, migration status/deploy/seed (`spawn EPERM`), database/full backend/foundation HTTP tests, Next.js full build (`spawn EPERM`). Flutter test commands found no tests. Earlier changelog PASS reports remain historical; none is relabeled as a new live result.
- Documentation: corrected obsolete empty-repository statements, documented all 36 current routes with authorization/DTOs/errors/idempotency/side effects, recorded exact session command results, and added Phase 12 foundation history.
- Files: root package scripts; Prisma helper; backend test runner and three test files; README and eight documentation files under docs.
- Database/API/Flutter/Admin changes: no new migrations, business routes or client screens. Generated client and build outputs refreshed by validation.
- Current frontier: engineering Phase 5 Core Domain is partial; current Phase 12A live validation gate is BLOCKED. Next: restore runtime access, finish migration/seed/integrity/integration checks, then complete Phase 5 before bookings/pricing.

See [session evidence](validation-2026-09-19.md) and [current status](codex-implementation-status.md).

## 2026-09-19 — Phase 4: Authentication and authorization, local validation

- Implemented: phone/OTP DTOs, cryptographically random six-digit codes, HMAC-at-rest, five-minute expiry, five-attempt lockout, Redis atomic phone/IP rate limits, server-side opaque access/refresh sessions, hashed tokens, fifteen-minute access expiry, thirty-day refresh expiry, rotation and family-wide replay/logout revocation.
- Authorization: deny-by-default global guard; explicit public annotations; live user status, role/permission and company/team checks; no self-registration as provider/admin; resource-scope helpers. New users receive CUSTOMER only.
- Database: `0003_session_rotation` adds token-family identifiers; deployed successfully. Earlier migrations preserved.
- Local validation: backend build and four automated tests PASS, including HTTP login, one-time OTP use, failed-attempt persistence, expiry, injected-role rejection, token rotation/replay, logout, provider scope filtering and infrastructure/error regressions.
- External integration: development delivery writes codes only under ignored `.local/otp`; production rejects this adapter. Twilio Messages adapter follows https://www.twilio.com/docs/messaging/api/message-resource and https://www.twilio.com/docs/usage/requests-to-twilio . Live delivery is BLOCKED on credentials/provider account and is NOT VALIDATED. No real messages sent or purchases made.
- Next: Phase 5 core domain and resource-ownership HTTP tests. Production readiness remains blocked; the explicitly documented development adapter supports continued local implementation per prompt section 31.

## 2026-09-19 — Phase 3: Backend infrastructure

- Implemented: validated Nest ConfigModule; global Prisma and Redis lifecycle providers; liveness/readiness; request IDs; structured metadata-only request logs; safe exception filter; DTO validation; standard success/error envelopes; Helmet, CORS allowlist and JSON body size limit.
- API changes: GET `/api/v1/health/live` and GET `/api/v1/health/ready`; readiness checks both PostgreSQL and Redis and returns sanitized 503 on failure. No protected business endpoint exists yet.
- Validation: backend TypeScript build PASS; two automated infrastructure tests PASS, including real readiness, headers, CORS, missing routes, configuration rejection and sanitized dependency failure. Malformed-body regression added before final rerun.
- Dependencies: Nest configuration module added; unused Prisma adapter removed; install audit still reports zero vulnerabilities.
- Next: authentication, expiring/revocable sessions, scoped authorization and abuse controls. No production OTP credentials are configured.

## 2026-09-19 — Phase 2: Database + Prisma validated

- Implemented: full relational foundation in `database/prisma/schema.prisma`, generated `0001_init`, PostgreSQL-specific `0002_integrity`, Prisma configuration and deterministic seed.
- Separate payment transactions/events/refunds/cash collections, per-booking provider payables, settlement batches/items/payments, assignments/events, status history, snapshots, outbox, sessions/OTP/idempotency, support, promotions and notifications are represented. Their business services remain unimplemented.
- Constraints: customer ownership via composite foreign keys; assignment company/team consistency; one active assignment per booking; nonoverlapping active team time slots; signed settlement balances; fixed-precision monetary checks; append-only audit/history/transactions; immutable snapshots.
- Decisions: interpret early per-booking settlement as ProviderPayable and later batch model as Settlement + SettlementItem. Preserve the specified DECIMAL(12,2) contract; three-decimal JOD amounts are not supported by that contract. Seed catalog drafts stay inactive with zero example prices until operations configures real commercial values.
- Validation commands: `npm run prisma:validate`, `prisma:generate`, `prisma:deploy`, `prisma:status`, `prisma:seed` twice, `npm run test:database`.
- Results: PASS; five roles, thirty permissions, two inactive service drafts. Fresh migrations and repeatable seed also passed in a disposable schema with 16 integrity assertions. Temporary test schema removed afterward.
- Fixes before passing: explicit composite uniqueness for one-to-one relations; root ESM declaration for seed execution. No applied migration was rewritten.
- Dependency note: npm's workspace `ls` reports the intentionally overridden deepmerge version as invalid against its parent's exact dependency, although clean install/audit and Prisma CLI execution pass. Override is retained to avoid the advisory; no untrusted configuration is accepted.
- Next: Phase 3 backend infrastructure. No domain or UI capability is claimed by these database checks.

## 2026-09-19 — Phase 1: Foundation created and validated

- User authorized creating all missing implementation in this workspace; no pre-existing migration history is available here. Initialized local Git, with no remote or commits created.
- Implemented: npm workspaces, pinned backend/admin manifests and lockfile, NestJS liveness shell, Next.js shell, separate Flutter Android/iOS/web shells, private environment generation, local Compose definition, WSL bootstrap and foundation smoke test.
- Runtime: installed PostgreSQL 16.15 and Redis 7.0.15 in the existing Ubuntu WSL distribution. Dedicated Home Clean PostgreSQL cluster at 55432 and Redis at 56379; preserved disabled Windows drive mounting. The package installation also created default distro services; Home Clean uses its dedicated instances.
- Validation: backend TypeScript build PASS; admin optimized build PASS; both Flutter analyzers and web builds PASS; authenticated PostgreSQL query PASS; Redis PING PASS; backend and admin HTTP startup smoke checks PASS.
- Dependency correction: Prisma 7.10 CLI brought vulnerable mysql2/deepmerge dependencies. Pinned Prisma/client/adapter 6.19.3 and deepmerge-ts 8.0.2 override. Re-resolved the initial lock/tree after npm failed to apply the override incrementally. Fresh install: 0 vulnerabilities. Initial dependency tree preserved under ignored `.local/dependency-backup`.
- Database changes: local empty database/role only. No domain migration yet. API: GET `/api/v1/health/live` only. Flutter/Admin: explicit unavailable shells, no business features.
- Docker Compose runtime NOT RUN because Docker is unavailable; actual PostgreSQL/Redis runtime validated through WSL. Android APK and iOS builds NOT RUN; iOS requires macOS. These are tracked platform/deployment checks, not substitutes for completed web/SDK checks.
- Next: Phase 2 database schema, versioned migration, deterministic seed and live integrity tests. Prisma schema/migration checks belong to this phase because no schema existed during foundation setup.

## 2026-09-19 — Phase 0: Repository audit

- Implemented: repository map, evidence-based status, missing-artifact and architecture conflict register.
- Files changed: `docs/codex-implementation-status.md`, `docs/codex-changelog.md`.
- Database/API/Flutter/Admin changes: none.
- Tests/validation commands: `rg --files`; `Get-ChildItem -Force -Recurse -File`; `git status --short`; bounded `Get-Content` reads of the complete master; supporting-document prefix comparison; PowerShell XML parsing of all draw.io files.
- Validation results: file inventory and XML parsing PASS; Git baseline unavailable (not a repository); database diagram is empty; application validation NOT RUN because application files are absent.
- Known issues: master claims a Phase 12A implementation that is not in the supplied workspace. Existing migration history must be recovered or explicitly established as absent before creating a replacement.
- Next step: Phase 1 toolchain checks and resolution of missing foundation code.

## 2026-09-19 — Phase 1: Foundation validation attempt

- Implemented: current architecture/API/database/deployment documentation, explicitly distinguishing specification from absent implementation.
- Files changed: six Markdown documents under `docs/`.
- Database/API/Flutter/Admin implementation changes: none.
- Validation commands/results: `node --version` PASS (24.15.0), `npm.cmd --version` PASS (11.12.1), `git --version` PASS (2.49.0.windows.1), `flutter --version` PASS (3.41.9 / Dart 3.11.5), `flutter doctor -v` completed with Android PASS and missing optional Windows desktop C++ components.
- Environment check: Docker, psql and redis-cli not on PATH; no matching service discovered. Flutter required approved access outside the workspace for its SDK cache; the stalled sandboxed check was terminated.
- Application/database validation: BLOCKED, no manifests/schema/migrations/seed or application source. No dependencies installed and no database modified.
- Next step: recover existing Phase 12A code or confirm a fresh foundation, then complete Phase 1 before starting Phase 2.

# 2026-09-23 — Phase 15 Batch 2 external services (partial)

- Added Twilio Verify OTP provider and role-specific Customer, Provider and Admin challenge routes; updated Admin and Provider clients.
- Added Tap JOD hosted charge/refund and signed charge webhook adapter with stable idempotency references.
- Added FCM HTTP v1 sender through the Firebase APNs bridge, stale-token retirement and delivery collapse hints.
- Added Customer Flutter HTTPS hosted checkout launch via `url_launcher`; success still comes only from the backend webhook.
- Added scoped team tracking and GPS arrival event using existing Team coordinates; added routing/storage interfaces and a private local media adapter.
- Added adapter/security tests and documentation. Production remains fail-closed pending maps/storage decisions and the Batch 2 gaps in the implementation report. No migration, commit, push, deployment or real external request occurred.
