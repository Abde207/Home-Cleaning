# Home Clean App — Production Readiness Audit

Audit date: 2026-09-22  
Scope: read-only audit of the repository after Backend 5–11, Customer 12A–12E, Provider 13A–13D, and Admin 14A–14H.  
Application source, tests, Prisma schema, migrations, deployment state, and external integrations were not changed.

## 1. Executive summary

The completed domain scope is substantially implemented and locally validated. PostgreSQL/Prisma persistence, authentication/session rotation, authorization isolation, booking state ownership, pricing, dispatch, finance/settlements, notification outbox persistence, location freshness, Customer Flutter, Provider Flutter, and the Admin application all have repository evidence and focused tests.

The repository is not production-deployable as-is. The main blockers are the absence of credentialed production providers and the production operating perimeter: payments are mock-only, push is mock-only, geocoding is deterministic, completion proof has metadata only, there is no CI/CD or production deployment definition, no production backup/restore runbook, no release signing setup, and no operational monitoring/alerting. The backend listener is bound to loopback. The Customer Android release manifest does not declare INTERNET permission, while the Provider manifest does.

The audit found no new domain authorization or financial-integrity defect requiring an application-code fix within the completed scope. It did find operational risks in the unimplemented perimeter and one worker recovery gap: a notification delivery left in `SENDING` when its process crashes is not selected by the current retry sweep.

Overall classification: **not ready for public production launch**. A controlled staging environment can be prepared after the P0/P1 prerequisites are addressed; no production deployment should be inferred from the passing local tests.

## 2. Current architecture

Actual repository topology:

- `backend/nestjs`: NestJS modular monolith, global `/api/v1`, Prisma/PostgreSQL, Redis, HTTP health endpoints, Auth/Core/Booking/Pricing/Dispatch/Payments/Notifications/Location/Provider/Admin modules.
- `mobile/customer_flutter`: separate Customer Flutter application with secure session storage, API base URL supplied through `--dart-define`, customer booking/payment boundaries, localization, and notification registration contract.
- `mobile/provider_flutter`: separate Provider Flutter application with provider scope, assignment/job execution, cash and settlement visibility, localization, and secure session storage.
- `admin/nextjs`: Next.js 16 App Router Admin BFF and bilingual dashboard. Server-only backend access uses HTTP-only cookies and same-origin mutation routes.
- `database/prisma`: Prisma schema, seven ordered SQL migrations, and transactional seed.
- `compose.yaml`: local PostgreSQL 16 and Redis 7 only.
- `scripts`: local bootstrap, direct clean-schema validation, worker-process validation, and local Prisma helpers.
- `docs` and UML/specification files: architecture, API, phase records, deployment notes, and validation evidence.

The documented architecture is consistent with the actual modular monolith and database ownership boundaries. The completed implementation keeps Booking as the state owner and keeps clients from writing business truth directly. Documentation is not fully current in every historical file: `docs/deployment.md` still describes older “no tests” and “workers remain specified” conditions even though the repository now contains and validates notification and dispatch workers. `docs/codex-implementation-status.md`, `docs/api.md`, and the Phase 14H report are the more current records.

Implementation classification:

| Area | Actual state | Production classification |
|---|---|---|
| Core domain, booking, pricing, dispatch, finance, authorization | Implemented and locally validated | Production code candidate; still requires production environment validation |
| Customer and Provider apps | Implemented and tested against repository adapters | Staging candidate; release/signing and live-service validation incomplete |
| Admin | Implemented, typechecked, tested, production build reported passing | Staging candidate; deployment, domain, cookie, and operational setup incomplete |
| OTP | Twilio branch exists; file mode is local-only | Partially integrated; no live provider evidence |
| Payments | Provider interface plus `MockPaymentProvider` and signed mock webhook | Mock adapter only |
| Push | Provider interface plus `MockPushNotificationProvider` | Mock adapter only |
| Maps/location | Deterministic geocoder and stored coordinates | Development/test implementation only |
| Completion proof | Immutable metadata/storage key only | Object storage not implemented |
| Deployment/CI/observability/backup | Local scripts and documentation only | Missing production platform work |

## 3. Completed scope

The audit accepts the user-specified completion boundary and the Phase 14H evidence: Backend Phases 5–11, Customer Flutter 12A–12E, Provider Flutter 13A–13D, and Admin 14A–14H are complete for their documented scoped gates. Phase 14H explicitly reports no application defect found and no source, schema, migration, or architecture change.

That completion statement does not mean external providers, release signing, backups, CI/CD, public domains, production secrets, live mobile sessions, or operational support are complete. Those are separate production-readiness dependencies.

## 4. External integrations

| Integration | Classification | Evidence and gap |
|---|---|---|
| OTP/SMS | Implemented abstraction/adapter, not production-validated | `OtpSender` supports local file delivery and a Twilio HTTP call. Production rejects file mode and requires Twilio-shaped settings, but the current private environment has no Twilio variables and no live send, delivery-status handling, provider account setup, sender registration, spend controls, or production alerting. |
| Payments | Abstraction with mock adapter | `PaymentProvider` supports create/refund/webhook verification, but `PaymentService` always constructs `MockPaymentProvider`; configuration accepts only `mock`. The checkout URL is deliberately invalid, so no real online payment can complete. |
| Payment webhook | Contract implemented for mock provider | Raw-body capture, HMAC verification, event uniqueness, amount/currency/reference validation, and duplicate handling exist. A real gateway still requires a provider-specific adapter, credentials, webhook registration, timestamp/replay policy as required by that provider, operations for failed/late events, and sandbox/live certification. |
| Refunds | Mock synchronous provider call | Refund accounting and bounds are implemented, but the external refund call is made inside the database transaction. A real provider failure/retry/timeout strategy must be designed and tested; no real refund rail exists. |
| Push notifications | Mock adapter only | Delivery records, device-token lifecycle, retry/backoff, invalid-token cleanup, and outbox materialization exist. FCM/APNs credentials, provider client, platform token acquisition, platform permission prompts, delivery receipts, and provider-specific failure handling are absent. |
| Maps/location | Deterministic local provider | Address text is converted to deterministic coordinates without a map service. Dispatch ETA is approximate straight-line/area-center logic. There is no production geocoder, reverse geocoder, routing, road ETA, API-key restriction, quota/billing, or provider fallback. |
| Object storage/completion proof | Not implemented | `CompletionProof` stores `storageKey`, MIME type, and byte size; the Provider app submits metadata/reference only. There is no upload authorization, bucket/container, signed URL, access control, file-content validation, malware scanning, retention, or deletion process. |

No external provider was invented in this audit. The only selected external names found in the repository are Twilio for OTP and the architecture’s FCM/APNs/map/object-storage categories; payment gateway and storage vendors are not selected.

## 5. Environment/configuration

Configuration sources inspected: root `.env` (metadata only), `.env.example`, NestJS environment validation, Admin API/session helpers, Flutter runtime configuration, Compose, scripts, and documentation. Secret values were not printed.

The ignored private `.env` exists and contains local database, Redis, CORS, OTP hash, and OTP delivery settings. It does not contain the Twilio, real payment, Admin backend URL, push, map, or storage settings documented as future production requirements. `.env.example` contains placeholders for the current local/OTP/payment settings but no FCM/APNs, map, object-storage, webhook-provider selection, production domains, cookie/trusted-origin, or worker deployment configuration.

Important findings:

- `NODE_ENV=production` requires Twilio mode and a payment webhook secret, but `PAYMENT_PROVIDER` still only accepts `mock`; there is no production payment provider configuration path.
- `PaymentService` has a hardcoded local fallback webhook secret when the environment value is absent. Production validation prevents the normal production boot path, but this is unsafe configuration hygiene and must not survive a production-capable payment implementation.
- `BACKEND_API_URL` is required by the Admin server-only client but is not present in the current private `.env`; it is documented only in the example. Flutter API URLs are compile-time `--dart-define` values, with no checked-in staging/production build profiles.
- `CORS_ORIGINS` is validated and HTTPS is required in production, but the example is localhost-only. The deployment must supply the exact Admin/mobile/browser origins.
- `DISPATCH_WORKER_ENABLED` is documented; `NOTIFICATION_WORKER_ENABLED` is used by code but is not documented in `.env.example`.
- Database/Redis URLs have no production pool, TLS, timeout, or managed-service policy documented. Redis local Compose has no authentication/TLS configuration.
- `.env` is ignored by Git. However, repository files are untracked in the inspected worktree, so historical source-control exposure and review ownership cannot be established from Git history.

## 6. Security

### Positive controls verified in code/tests

- Opaque access and refresh tokens are stored hashed in PostgreSQL; access tokens expire in about 15 minutes and refresh sessions in about 30 days.
- Refresh rotation and replay revocation are serialized by PostgreSQL advisory locks; logout revokes the refresh family.
- OTP challenges have five-minute expiry, five verification attempts, Redis IP/phone request limits, and one-time use.
- Global DTO whitelist/unknown-field rejection, UUID parsing, 64 KB JSON limit, sanitized error envelopes, Helmet, request IDs, and controlled CORS are present.
- Customer ownership, company isolation, team isolation, assignment scope, settlement scope, and Admin platform-grant checks were covered by the Phase 14H evidence.
- Admin access tokens are in HTTP-only cookies; cookies are SameSite Strict and Secure in production. Mutating BFF routes require same-origin checks and the browser does not receive backend bearer tokens.
- Financial mutations use locks, idempotency, explicit commands, audit/history, and server-owned amounts. Webhooks use raw-body HMAC verification and unique provider/event IDs.
- Admin projections omit device tokens, raw provider payloads, unrestricted notification payloads, and other sensitive fields; audit detail recursively redacts sensitive key names.

### Findings

| ID | Severity | Finding | Next action |
|---|---|---|---|
| SEC-01 | HIGH | Admin refresh coalescing is process-local. Multi-instance Admin deployment can race a rotating refresh token family. | Use a shared refresh lock/result coordinator or keep Admin single-instance until this is solved and tested. |
| SEC-02 | HIGH | Production TLS, reverse-proxy trust, host/domain policy, and exact trusted Admin origins are deployment assumptions, not repository configuration. | Define HTTPS termination, trusted host/origin policy, HSTS, cookie domain/path policy, and proxy forwarding rules before staging. |
| SEC-03 | MEDIUM | Rate limiting is concentrated on OTP and refresh. No general API/command/webhook abuse policy or gateway-level throttling is present. | Add deployment/API-gateway limits and alerts for authentication, commands, webhook traffic, and expensive reads. |
| SEC-04 | MEDIUM | Notification delivery errors are persisted as raw provider error text. A real provider may return sensitive request/account details. | Define provider-error redaction and logging/storage retention rules. |
| SEC-05 | MEDIUM | Device tokens are stored as operational identifiers in PostgreSQL without an application-level encryption/retention policy. | Decide whether database encryption/managed encryption is sufficient and define token retention/deletion. |
| SEC-06 | MEDIUM | Admin has one platform role with finance/configuration mutation grants; permission separation exists, but maker/checker or dual-control approval does not. | Make the business risk decision; implement a separate governance model before high-value finance operations if required. |
| SEC-07 | LOW | Session, OTP, notification, audit, outbox, and device-token cleanup/retention jobs are not present. | Define retention periods and scheduled cleanup with audit-safe deletion rules. |

No authorization-isolation defect was found in the inspected completed paths. This is not a claim that an independent penetration test has been performed.

## 7. Database

The repository contains **seven** ordered migrations; `0007_phase11_notifications_location` is latest. The schema and the migration responsibilities are consistent with the documented domain model. The Phase 14H evidence reports all seven applying successfully in direct fresh-schema runs and repeated deterministic seed verification.

Verified schema strengths:

- PostgreSQL foreign keys are generally restrictive; ownership/scope composite keys protect customer and provider boundaries.
- Booking snapshots, historical prices, immutable rules/promotions, status histories, assignment events, payment events, and audit records are represented separately.
- Unique constraints protect booking numbers, payment provider event IDs, payment attempts/request keys, idempotency keys, quote consumption, allocation uniqueness, notification event keys (via the migration), and delivery attempt numbers.
- Indexes cover primary operational filters, ownership, statuses, time ranges, assignments, settlements, notifications, and outbox polling.
- Financial values use `DECIMAL(12,2)` and JOD is the default currency. The documented precision decision is retained; business approval is needed if three-decimal JOD accounting is required.
- `btree_gist` is required by migration integrity rules and must be available to the production database user/platform.

Seed behavior is transactional and idempotent for five roles, the permission catalog, grants, and two inactive zero-price catalog drafts. It is additive and does not remove stale grants. No Admin bootstrap HTTP route exists; an Admin phone must be provisioned through a controlled process.

Production gaps:

- No backup, point-in-time recovery, restore test, migration rollback, or forward-fix runbook exists in the repository.
- Prisma production migration execution is documented but not represented as a deployment job. Native wrapper validation has known Windows `spawn`/proxy limitations.
- Connection pooling and production transaction/statement timeout settings are not configured. A managed PostgreSQL pooler or explicit Prisma pool limits are required before horizontal scale.
- Retention/archival strategy for audit, notifications, outbox, sessions, OTP challenges, payment histories, and location data is not defined.

## 8. Redis/workers/outbox

Redis is used for authentication rate limits. It is not the source of booking, payment, settlement, dispatch, or notification truth. Compose enables Redis AOF locally, but there is no managed Redis, authentication/TLS, backup policy, capacity policy, or monitoring configuration.

Dispatch and notifications use PostgreSQL-backed polling workers:

- Dispatch polls every 10 seconds, uses row locks and durable booking state, and has separate-process convergence/recovery evidence.
- Notification outbox materialization and delivery polling run every 5 seconds in the NestJS process, with database locking, five delivery attempts, exponential delay, invalid-token cleanup, and delivery history.
- There is no BullMQ queue in the repository. There is no separate worker entrypoint, worker deployment unit, dead-letter queue, operator replay/requeue command, queue-depth alert, or worker-specific readiness signal.
- A process crash after a notification delivery is claimed changes the row to `SENDING`; the retry query selects only `PENDING`. Without a stale-claim recovery sweep, that delivery can remain stuck. This is a **HIGH operational finding** for any launch that relies on push delivery.
- API instances each construct worker timers. Database locks make many dispatch sweeps converge, but worker ownership, capacity, backpressure, and notification throughput are not operationally defined.

Production requirement: deploy a deliberate worker topology (dedicated worker or explicitly bounded co-resident worker), add stale-claim recovery and dead-letter/replay operations, monitor lag/failures, and test crash/restart behavior with the real push provider.

## 9. Docker/deployment

`compose.yaml` is local-development infrastructure only. It contains PostgreSQL 16 and Redis 7, loopback-bound ports, named local volumes, healthchecks, and required environment interpolation. It does not contain the backend, Admin, worker, reverse proxy, object storage, or external provider services.

Production gaps:

- No backend or Admin Dockerfiles/images are present.
- No production Compose/Kubernetes/VM/service definitions, restart policies, resource limits, secure networks, secret injection, TLS termination, or autoscaling policy are present.
- PostgreSQL and Redis ports/volumes are local defaults; the Compose Redis instance has no auth/TLS and the Postgres volume has no backup/restore integration.
- Migration deployment, seed policy, health/readiness routing, worker startup/shutdown, and rollback handling are not encoded in a release process.
- `backend/nestjs/src/main.ts` listens on `127.0.0.1`. A container or separately routed host will not accept ingress on its network interface without an explicit deployment workaround.

Required deployment units are Backend API, a worker process or controlled worker mode, Admin Next.js, managed PostgreSQL, managed Redis, HTTPS/domain routing, and object storage once completion proof is enabled.

## 10. CI/CD

No GitHub Actions, CI YAML, release pipeline, security scanning, migration check, Android release build, iOS build, Admin deployment, backend image build, or staging smoke pipeline was found.

The repository has local scripts for backend/Admin builds, direct clean-schema tests, dispatch-process validation, and Flutter validation. These are useful evidence but are not a controlled delivery pipeline. Required CI/CD gates are lint/static analysis, unit/integration tests, clean migration/seed checks, backend/Admin builds, Flutter analyze/test/release builds, dependency/security scanning, artifact signing, staging deployment, smoke tests, migration approval, and manual production approval.

## 11. Customer Flutter release readiness

Current state:

- Package/application identifier: `jo.homeclean.home_clean_customer`.
- Version is placeholder `1.0.0+1`.
- API URL is compile-time `API_BASE_URL`; no production value is committed, which is appropriate, but no release profile/pipeline supplies it.
- Secure storage is used for session material and the app avoids client-side business truth.
- Debug APK, analyzer, and 56 tests are reported passing; this is not a release build or live production validation.
- Android release signing is explicitly configured to use the debug key.
- `mobile/customer_flutter/android/app/src/main/AndroidManifest.xml` does not declare INTERNET; the permission appears only in debug/profile manifests. The release manifest therefore needs verification/fix before any Android production release.
- No FCM/APNs integration, notification permission setup, location permission, deep-link configuration, release analytics/crash reporting, or store metadata is present.
- iOS bundle identifier exists, but iOS was not built on Windows and no production team/certificate/profile evidence exists.
- Icons and splash assets exist, but brand/store compliance and final metadata are not verified.

Classification: **not release-ready**. Android signing/permission, iOS signing/build, production API configuration, provider integrations, QA on release artifacts, and store submission preparation are missing.

## 12. Provider Flutter release readiness

Current state:

- Package/application identifier: `jo.homeclean.home_clean_provider`.
- Version is placeholder `1.0.0+1`.
- API URL is compile-time and environment-driven; no release profile/pipeline supplies a production value.
- Secure storage, scoped provider commands, safe logging, and 73 tests/analyzer/debug APK evidence are present.
- Android release signing is explicitly configured to use the debug key.
- Android main manifest declares INTERNET, but there is no production push provider/token source, notification permission setup, live location/GPS integration, deep-link configuration, crash reporting, or release pipeline.
- Completion proof submits metadata/reference only; no object upload exists.
- iOS was not built on Windows and production signing/team/profile evidence is absent.
- Store metadata, privacy declarations, icon/brand approval, and release QA are not verified.

Classification: **not release-ready**. The same signing, iOS, environment, integration, store, and live-service gaps apply independently of the Customer app.

## 13. Admin release readiness

Implemented release mechanics:

- Next.js production build and TypeScript checks are reported passing.
- `BACKEND_API_URL` is server-only and validated as an API URL; production non-local URLs must use HTTPS.
- BFF cookies are HTTP-only, SameSite Strict, Secure in production, and refresh is path-scoped.
- Same-origin and fixed command allowlists protect Admin mutations.

Gaps:

- No Admin container/deployment definition, domain/HTTPS setup, trusted proxy/host policy, or runtime secret injection is present.
- `next.config.ts` sets `typescript.ignoreBuildErrors: true`; the separate typecheck script is the real gate, but the production build itself is configured to ignore TypeScript errors.
- Refresh coalescing is process-local and unsuitable for horizontally scaled Admin without shared coordination.
- No production logging/error tracking, uptime check, WAF/rate-limit policy, cookie domain policy, or deployment smoke test is defined.
- The current private `.env` does not contain `BACKEND_API_URL`; the production runtime must supply it.

Classification: **application build-ready, deployment-not-ready**.

## 14. Backend production readiness

Implemented:

- Nest lifecycle connects/disconnects PostgreSQL and Redis; shutdown hooks are enabled.
- `/api/v1/health/live` is a process liveness check; `/api/v1/health/ready` checks PostgreSQL and Redis.
- Request IDs, JSON request logs, sanitized error envelopes, Helmet, CORS, DTO validation, 64 KB body limit, and explicit authentication/authorization are present.
- Dispatch and notification timers clear on module shutdown.

Operational gaps/findings:

- The listener binds to loopback rather than a configurable interface.
- Readiness does not verify worker health, outbox lag, notification stuck claims, external provider reachability, or migration compatibility.
- No metrics, tracing, OpenTelemetry/exporter, structured log sink, error tracking, or alert integration is present.
- No general API rate limiting, request concurrency budget, DB pool settings, graceful drain/readiness transition, or reverse-proxy timeout policy is configured.
- Redis outage prevents readiness and authentication rate-limit operations; production failover behavior is not tested.
- External provider calls have bounded timeouts in OTP, but provider-specific retry/circuit-breaker/idempotency policies are not implemented.
- No separate worker startup/shutdown contract exists. The current timers run inside the API process.

## 15. Observability

Already implemented: request IDs, metadata-only request/error logs, health endpoints, transactional AuditLog, booking/payment/settlement histories, notification delivery attempts, outbox attempt counters, Admin audit/finance/notification/location read models, and server-side operational counts.

Not implemented or not configured: centralized logs and retention, error tracking, latency/error metrics, distributed tracing, uptime monitoring, PostgreSQL monitoring, Redis monitoring, worker/outbox lag dashboards, push delivery/provider dashboards, payment success/webhook/reconciliation alerts, cash/settlement exception alerts, audit access monitoring, and on-call notification paths.

These require external operational tooling and alert ownership; they are not supplied by the repository.

## 16. Backup/disaster recovery

No backup scripts, managed-database policy, restore test, RPO/RTO, disaster-recovery runbook, cross-region strategy, or migration rollback procedure is present.

Required decisions/work:

- PostgreSQL automated backups, PITR, retention, encryption, and periodic restore validation.
- Backup coverage for audit/financial/history data and verification that restore preserves migration ledger/extension state.
- Redis recovery expectations: Redis does not own financial/business truth, but rate-limit continuity and worker performance after recovery need defined behavior.
- Object-storage versioning/retention/backup once proof media exists.
- Forward-only migration rollback strategy, with pre-migration backup and tested forward-fix procedure.
- Incident recovery ownership, runbook, break-glass access, and communication procedure.

No production data was deleted, restored, or deployed during this audit.

## 17. Business configuration

These are configuration/operations decisions, not automatic implementation assumptions:

- Jordan launch geography/service areas, coordinate source, address acceptance, operating hours, holidays, booking windows, capacity, and dispatch calibration.
- Active service catalog, prices, extras, duration, pricing rules, promotions, commission rates, currency precision, and tax/fee treatment.
- Cancellation, refund, no-show, cash collection, cash reconciliation, provider settlement cadence, payout direction, and exception approval policy.
- Provider onboarding and verification, Admin identity pre-provisioning, role/grant approval, support escalation, incident ownership, and customer/provider contact procedures.
- Notification templates and language/content approval, SMS sender/opt-out rules, push categories, and fallback behavior.
- Whether production launches without live customer tracking/ETA, online payments, proof upload, ratings, support tickets, or push delivery.

Current seed creates only inactive zero-price catalog drafts. No production commercial configuration is supplied.

## 18. Privacy/data handling

Stored categories identified from the schema and projections:

- Identity: phone, name, locale, status, sessions, roles/grants, OTP challenge metadata.
- Customer: addresses, coordinates, property type/size/rooms/bathrooms, booking schedules and instructions.
- Booking/finance: snapshots, price/quote terms, payment references/events/attempts, refunds, cash collection, settlement allocations and reconciliation details.
- Provider operations: company/team membership, team locations/timestamps, schedules, capabilities, assignments and completion-proof metadata.
- Notifications/device: notification payloads, read/delivered state, device tokens, delivery/provider references and errors.
- Governance: audit before/after JSON, actor, reason, request ID, status histories, dispatch candidates, outbox payloads.

Access controls and redacted Admin projections are strong within the implemented API. The following are unresolved policy/operational decisions, not legal conclusions: retention periods, account deletion/anonymization, address/location retention, audit immutability/retention, OTP/session cleanup, device-token deletion, financial-record retention, backup access, object-storage access/expiry, data export, incident disclosure, and privacy-policy/consent wording. These require legal/privacy and business review.

## 19. Testing coverage

The Phase 14H report establishes:

- Backend unit suite: 42/42.
- Fresh-schema integration groups covering Auth/Core/Infrastructure, Booking/Pricing/Lifecycle, Dispatch/Provider, Finance, Admin, and Phase 11 regressions.
- Separate-process Dispatch convergence/termination/restart recovery: 1/1.
- Customer Flutter: 56/56, analyzer, Android debug build.
- Provider Flutter: 73/73, analyzer, Android debug build.
- Admin: 15/15, TypeScript, production build.
- Seven migrations and deterministic seed checks in direct fresh schemas.

What this establishes: local domain transitions, authorization negative paths, locking/idempotency, financial invariants, projections/redaction, client state/retry/localization behavior, and build-level correctness against deterministic/mock adapters.

What it does not establish: live SMS, payment gateway, refund rail, FCM/APNs delivery, real geocoding/routing, object upload/access, production TLS/proxy behavior, release-signed APK/IPA behavior, iOS builds, app-store installation/update flows, load/soak/capacity, managed-service failover, restore tests, CI reproducibility, multi-instance Admin refresh, notification crash recovery, or penetration testing.

The repository has useful unit, integration, Admin, Flutter, and separate-process tests, but no automated CI executes them. Migration rollback, seed drift/reconciliation, operational alert tests, and production-like external contract tests remain unverified.

## 20. Production configuration matrix

| Area | Current state | Production requirement | Status | Blocking? | Owner/next action |
|---|---|---|---|---|---|
| PostgreSQL | Seven migrations, schema constraints, Prisma client, local Compose | Managed HA/connection policy, backups/PITR, restore test, migration runbook, extension | Partial | Yes | Platform/Backend: provision and validate staging DB |
| Redis | Auth rate limits; local AOF Compose | Managed Redis, TLS/auth, capacity/failover policy, monitoring | Partial | Yes for auth/ops | Platform: provision and test failover |
| Backend | Nest app, health, shutdown, validation | Deployable image/service, bind interface, proxy/timeouts, secrets, autoscaling policy | Not ready | Yes | Backend/Platform: create staging deployment contract |
| Worker | Co-resident dispatch/notification timers | Dedicated or bounded worker, stale-claim recovery, DLQ/replay, alerts | Partial | Yes for reliable operations | Backend/Platform: define topology and recovery tests |
| Customer App | 56 tests/debug APK, env-driven URL | Release manifest, INTERNET verification, signing, release QA, store metadata | Not ready | Yes | Mobile: fix release profile and sign artifacts |
| Provider App | 73 tests/debug APK, env-driven URL | Release signing, live notification/location/proof integration, release QA | Not ready | Yes | Mobile: create signed staging/release pipeline |
| Admin | Production build/typecheck, BFF cookies | Runtime URL/secret injection, HTTPS/domain, trusted origin/proxy, multi-instance policy | Partial | Yes | Web/Platform: stage and smoke-test |
| OTP | File local mode; Twilio branch | Twilio account/sender, credentials, delivery monitoring, spend/rate policy | Partial | Yes | Backend/Ops: configure and live-test SMS |
| Payments | Mock provider and mock webhook | Selected gateway adapter, sandbox/live credentials, webhooks, refunds, reconciliation/alerts | Not implemented | Yes | Backend/Finance: select provider and implement/test adapter |
| Push | Mock provider and persisted deliveries | FCM/APNs implementation, credentials, token source, permissions, monitoring | Not implemented | Yes if push-dependent launch | Mobile/Backend/Ops: integrate and test |
| Maps | Deterministic geocoder and approximate ETA | Selected provider, restricted keys, quotas/billing, fallback, routing tests | Not implemented | Yes if live address/dispatch launch | Backend/Ops: select and integrate |
| Object storage | Metadata-only proof | Bucket, signed upload/download, validation, retention, access policy | Not implemented | Yes if proof required | Backend/Platform: select storage and implement workflow |
| Secrets | Ignored local `.env`, placeholders | Secret manager, rotation, no fallback secrets, environment inventory | Not ready | Yes | Platform/Security: provision and rotate |
| Domain/HTTPS | Localhost/loopback assumptions | Public domains, TLS, HSTS, proxy headers, exact origins/CORS/cookies | Not ready | Yes | Platform: configure and verify |
| Monitoring | Logs/request IDs/health/audit only | Logs, errors, metrics, traces, uptime, DB/Redis/worker/payment alerts | Partial | Yes for public launch | Ops: select tooling and alert owners |
| Backups | No repository backup/restore process | PostgreSQL PITR, restore drills, object backup, DR/RPO/RTO | Missing | Yes | Platform/Ops: create and test runbook |
| CI/CD | No CI/CD configuration found | PR gates, builds, scans, migrations, staging, approvals, signed artifacts | Missing | Yes | Engineering: create pipeline |
| App signing | Android release uses debug key; iOS unverified | Keystore/certificates, secure CI signing, app-store identities | Missing | Yes | Mobile/Release: establish signing custody |
| Store release | Placeholder version/metadata not verified | Final IDs, versions, privacy/store assets, staged rollout and rollback | Missing | Yes | Product/Mobile: prepare release packages |
| Business configuration | Inactive zero-price seed drafts | Approved catalog, pricing, areas, hours, commissions, policies, operators | Missing | Yes | Operations/Finance/Product: approve and load config |

## 21. P0/P1/P2/P3 findings

### P0 — cannot safely deploy

- **P0-01 Production payment path is absent.** Online checkout and real refunds cannot operate; only a mock provider and mock webhook exist.
- **P0-02 Production deployment perimeter is absent.** No deployable backend/Admin/worker definitions, CI/CD, secrets injection, HTTPS/domain configuration, backup/restore process, or monitoring/alert path exists.
- **P0-03 Backend ingress is not deployable as inspected.** The server binds to loopback; a production service/container must listen on its reachable interface.
- **P0-04 Mobile production artifacts are not safe to publish.** Both Android release variants use debug signing; Customer release manifest lacks the release INTERNET permission. iOS release signing/build evidence is absent.

### P1 — required before public launch

- **P1-01** Configure and live-test Twilio OTP, including sender/account setup, delivery failures, rate/spend monitoring, and production secret storage.
- **P1-02** Implement and certify the selected payment gateway adapter, webhook operations, refunds, retries, reconciliation, and production credentials.
- **P1-03** Implement production FCM/APNs and platform token/permission lifecycle if provider/customer operational notifications are part of launch.
- **P1-04** Replace deterministic geocoding/approximate location assumptions with an approved map/geocoding/routing strategy, or explicitly remove those launch dependencies and validate service-area behavior.
- **P1-05** Implement completion-proof upload/access through approved object storage if completion proof is required for completion/settlement.
- **P1-06** Establish managed PostgreSQL/Redis, pool/timeout settings, migration deployment, backups/PITR, restore testing, and DR ownership.
- **P1-07** Define worker deployment and fix stale `SENDING` notification recovery; add lag/failure/dead-letter/replay monitoring.
- **P1-08** Create CI/CD with security scanning, migration gates, backend/Admin/Flutter builds, signed artifacts, staging smoke tests, and production approval.
- **P1-09** Establish domains, HTTPS, reverse-proxy policy, Admin trusted-origin/cookie settings, CORS, rate limits, and production logging/alerting.
- **P1-10** Complete Customer and Provider release signing, iOS signing/builds, release QA, versioning, store metadata, and rollout/rollback procedures.
- **P1-11** Load approved business configuration and provision reviewed Admin/operator identities.

### P2 — required shortly after launch or before scale

- **P2-01** Add centralized logs, error tracking, metrics, tracing, uptime, database/Redis/worker/payment/push/webhook alerts, and on-call runbooks.
- **P2-02** Add notification replay/dead-letter operator controls and outbox/delivery retention cleanup.
- **P2-03** Add multi-instance shared Admin refresh coordination before horizontal Admin scale.
- **P2-04** Integrate settlement bank/payout rails if manual payout recording is insufficient for launch operations.
- **P2-05** Define and automate privacy retention/deletion/anonymization, device-token cleanup, session/OTP cleanup, and backup access controls.
- **P2-06** Run production-like load, soak, failover, crash-recovery, and real-provider fault tests.

### P3 — improvement/future

- **P3-01** Maker/checker governance and finer-grained Admin roles.
- **P3-02** Live provider tracking/customer ETA, if approved as a product requirement.
- **P3-03** Ratings and support workflows, which have schema placeholders but no implemented API boundary.
- **P3-04** Cursor pagination and broader search/index tuning after measured production workload.

## 22. Recommended next implementation sequence

This is a recommended post-audit sequence, not a new feature phase.

### Work package A — production decisions and platform baseline

- Objective: select providers, approve launch scope/policies, establish staging domains, secret ownership, PostgreSQL/Redis hosting, RPO/RTO, and Admin/operator provisioning.
- Dependencies: business decisions for payments, maps, push, proof, pricing, service areas, and settlement policy.
- Likely files/modules: environment example/validation, deployment documentation, backend startup, Admin runtime configuration, release scripts. No Prisma change expected initially.
- External credentials: Twilio, selected payment gateway, FCM/APNs, map provider, object storage, DNS/TLS, monitoring.
- Database impact: none unless measured production indexing or retention needs require a reviewed migration.
- Testing: configuration validation, staging connectivity, migration/seed repeatability, smoke tests, secret redaction checks.
- Deployment impact: creates the first reproducible staging environment.
- Timing: before staging.

### Work package B — backend ingress, workers, and operational reliability

- Objective: make API/worker runtime deployable, separate or deliberately bound worker execution, recover stale notification claims, and add readiness/lag/error signals.
- Dependencies: platform baseline and managed PostgreSQL/Redis.
- Likely files/modules: `backend/nestjs/src/main.ts`, health/bootstrap/config, DispatchWorker, NotificationWorker/Service, worker entrypoint and deployment definitions.
- External credentials: monitoring/error-tracking credentials; provider credentials may be needed for end-to-end worker tests.
- Database impact: possibly additive operational fields/indexes only after measured need; no schema change should be assumed.
- Testing: crash/restart, duplicate processing, stale claim recovery, worker scaling, graceful drain, load/soak, readiness behavior.
- Deployment impact: backend and worker images/services, health routing, restart/resource policies.
- Timing: before staging promotion.

### Work package C — credentialed external adapters

- Objective: integrate live OTP, the selected payment gateway/refund/webhook flow, push, maps/routing, and object storage as approved launch dependencies.
- Dependencies: provider selection, credentials, sandbox accounts, legal/business policies, package/platform setup for mobile.
- Likely files/modules: OTP sender/config; PaymentProvider/PaymentService/webhook/refund paths; NotificationProvider/token lifecycle; Location provider; completion-proof API and mobile upload flow; Flutter platform files.
- External credentials: all selected provider keys/secrets, webhook signing keys, FCM/APNs certificates/keys, map keys, bucket credentials.
- Database impact: likely none for adapter-only work; object-storage lifecycle metadata or webhook/provider records may require a reviewed migration.
- Testing: sandbox contract tests, signature/replay/amount/refund failures, SMS failure, push invalid-token/receipt, geocoder/routing quota/fallback, signed upload/access/retention.
- Deployment impact: secret rotation, webhook ingress, outbound egress, provider allowlists, alerting.
- Timing: before staging for every dependency included in launch; otherwise explicitly remove that feature from launch scope.

### Work package D — mobile and Admin release hardening

- Objective: produce signed staging/release artifacts with environment profiles, fixed Customer INTERNET permission, iOS signing/builds, notification configuration, versioning, and store readiness.
- Dependencies: Work packages A–C and final product launch scope.
- Likely files/modules: both Android Gradle/manifest trees, iOS Xcode projects/plists, Flutter build scripts/config, Admin deployment/runtime config.
- External credentials: Android keystore, Play/App Store accounts, Apple certificates/profiles/team, push credentials, crash reporting.
- Database impact: none.
- Testing: release APK/IPA install/update/rollback, live staging login/booking/provider/Admin journeys, mobile permission flows, RTL/LTR, offline/retry, deep links if selected.
- Deployment impact: artifact signing custody, staged rollout, store submission, Admin hosting.
- Timing: before staging acceptance and again before production.

### Work package E — CI/CD, observability, backup, and launch rehearsal

- Objective: automate quality gates and rehearse migration, deploy, monitoring, backup restore, rollback/forward-fix, incident response, and public-launch support.
- Dependencies: all prior work packages and approved RPO/RTO/ownership.
- Likely files/modules: new CI workflow/configuration, deployment manifests, runbooks, backup/restore scripts, monitoring integration; application changes only where diagnostics require them.
- External credentials: CI secret store, registry, cloud deployment, monitoring, backup, alerting, store signing.
- Database impact: migration pipeline validation and restore verification; no unreviewed production migration.
- Testing: clean-room CI, staging smoke, restore drill, provider outage drills, load/soak, security scan, signed artifact verification.
- Deployment impact: controlled staging-to-production promotion and rollback/incident procedures.
- Timing: before production.

## 23. Explicit known limitations

- No real payment gateway, bank payout rail, live SMS, FCM/APNs, map/routing service, or object-storage upload is implemented or credential-validated.
- Dispatch ETA and geocoding are deterministic/approximate and not a production location contract.
- Completion proof is metadata-only.
- Notification and dispatch workers are PostgreSQL-polling timers in the application process; notification stale-claim recovery is absent.
- Admin refresh coalescing is process-local.
- Android release signing is debug; Customer release INTERNET permission is not present in the main manifest.
- iOS builds/signing, store submission, production API sessions, TLS/proxy behavior, load/soak, DR restore, and CI reproducibility are not verified.
- One Admin role contains broad mutation permissions; maker/checker is not implemented.
- Support and ratings have schema placeholders but no implemented API workflows.
- Historical repository files are broadly untracked, so Git history cannot prove source ownership or prior secret exposure.

## 24. Explicit items not verified

- No production or staging deployment was performed.
- No external account, credential, webhook, SMS, payment, refund, push, map, upload, or store transaction was performed.
- No secret values were printed or validated against providers.
- No live PostgreSQL backup/restore, PITR, Redis failover, object-storage restore, migration rollback, or disaster-recovery rehearsal was performed.
- No iOS build or signing validation was performed on Windows.
- No release-signed Android artifact was built or installed.
- No production-like multi-instance Admin refresh test, worker scale test, notification crash-recovery test, load/soak test, penetration test, or independent privacy/legal review was performed.
- The full Phase 14H test totals were taken from the repository report; this audit did not rerun the full suite or alter generated/build artifacts.

## Final audit disposition

Audit completed. The repository is a strong completed implementation baseline, but it is a pre-production application rather than a production deployment package. Proceed with the post-audit work packages in dependency order; do not treat passing local tests as evidence that external operations, release signing, backups, CI/CD, or public launch are ready.
