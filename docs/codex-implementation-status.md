# Home Clean implementation status

## Phase 15 Batch 1 foundation — implemented and locally validated; Git commit blocked

Phase 15B/15H/15I add repository CI gates and a high-confidence secret scan; staging/production PostgreSQL and Redis TLS/credential policy; durable notification claim recovery, bounded outbox failures, redacted worker errors and focused restart/concurrency tests. PostgreSQL remains authoritative. No schema, migration, real provider, production infrastructure or deployment was changed. Local backend, database, Admin, Flutter, Compose, secret and separate-process Dispatch gates passed; hosted CI and production services were not exercised. Managed data services, real provider credentials, live push deduplication, Admin shared refresh coordination and production operations remain open. This workspace denies `.git/index.lock` creation, so normal commits and synchronization remain blocked. See [Batch 1 report](phase15-batch1-foundation-report.md) for exact validation results and limitations.

## Phase 15A production configuration foundation — COMPLETE for scoped validation

Phase 15A now has four explicit environment profiles, backend startup validation, public Flutter build profiles and startup URL validation, server-only Admin configuration validation, local-only Compose labeling, and an environment/secret-handling guide. The mock payment webhook fallback was removed and the existing private local `.env` was given a generated webhook secret. Seven existing migrations remain untouched. Production backend startup deliberately fails closed until a real payment adapter exists. Scoped validation passed: backend build, 42/42 unit, 27/27 isolated full test files (73 assertions), database checker 16 integrity assertions, Prisma validation, Admin typecheck/16 tests/build, Customer 57 tests/analyze/debug APK, Provider 74 tests/analyze/debug APK, and Compose config. See [Phase 15A report](phase15a-production-configuration-report.md) for exact commands and remaining blockers. The earlier read-only audit's “Phase 15 not started” statements below are historical.

Updated 2026-09-22 after Phase 14H hardening and validation. **Phase 14A, Phase 14B, Phase 14C, Phase 14D, Phase 14E, Phase 14F, Phase 14G, and Phase 14H are COMPLETE.** The final scope and evidence are in [phase14-admin-dashboard-blueprint.md](phase14-admin-dashboard-blueprint.md) and [phase14h-e2e-hardening-report.md](phase14h-e2e-hardening-report.md). No product feature, Customer/Provider behavior, or database migration was introduced in Phase 14H.

## Production Decisions Audit — COMPLETE for read-only assessment

On 2026-09-22, a read-only production decisions and platform baseline audit mapped the repository's external dependencies, required provider/credential choices, staging versus production gates, and decision dependencies. The result is [production-decisions.md](production-decisions.md). No provider was selected and no account, secret, deployment, external service, application source, schema, or migration was changed. Phase 15 and production integration remain not started. The next action is owner approval of launch scope, platform/trust boundary, provider choices and credential custody before any implementation package begins.

## Production-readiness audit — COMPLETE for read-only assessment

The post-Phase-14H production-readiness audit was performed against the actual repository on 2026-09-22. No application source, tests, Flutter UI, Admin UI, backend business logic, Prisma schema, migration, deployment, or external integration was changed. The audit report is [production-readiness-audit.md](production-readiness-audit.md).

The completed domain scope remains implemented and locally validated, but the repository is **not ready for public production launch**. P0/P1 blockers include the mock-only payment/push/geocoding boundaries, metadata-only completion proof, missing production deployment/CI/CD/backup/monitoring perimeter, loopback-only backend binding, debug Android release signing, missing Customer release INTERNET permission, absent iOS release evidence, and required business/provider configuration. The audit also records the notification-worker stale-`SENDING` recovery gap and the process-local Admin refresh coordination limitation.

This is an audit and handoff, not a new feature phase. The recommended post-audit implementation sequence is documented in the audit report and must be selected explicitly before work begins.

## Engineering Phase 14A Admin Security and Shell checkpoint — COMPLETE

- Seeded seven Admin read permissions idempotently in existing permission/grant tables, without a migration. Existing `/admin/**` controllers now require the route permission on the same active, unscoped `HOME_CLEAN_ADMIN` grant. Customer and Provider routes retain their authorization behavior.
- Added a same-origin Next BFF around existing OTP/verify/refresh/logout/me APIs. Tokens are HTTP-only, SameSite=Strict cookies, Secure in production; session mutations require same-origin requests. A verified non-Admin is rejected and its new backend session revoked. The protected layout rechecks `/auth/me` and fails closed. Refresh requests using the same incoming cookie coalesce within one Next process; multi-instance deployment needs shared coordination.
- Added English/Arabic locale routing, LTR/RTL document structure, design tokens, accessible shell, permission-aware **non-actionable** future navigation, foundation home, loading, forbidden, expired-session and application-error states. No 14B dashboard or business command pages exist.
- Exact acceptance results: `npm test -- auth.test.ts core.test.ts` — **2/2 PASS**; `npm run test:database` — **PASS**, **16 integrity assertions**; `npm test -- admin-foundation.test.ts` — **1/1 PASS**; backend unit tests — **42/42 PASS**; Admin foundation tests — **4/4 PASS**; backend build — **PASS**; Admin TypeScript — **PASS**; Admin production build — **PASS**; Docker/PostgreSQL — **operational**; **7/7 migrations** apply successfully; seed verification — **PASS**.
- The Docker/WSL environment blocker that previously prevented the clean-schema gates was resolved. Phase 14A is officially **COMPLETE**. At that earlier closeout point Phase 14B–14H were **NOT STARTED**; Phase 14B is now complete in the checkpoint below, and Phase 14C–14H remain explicitly **NOT STARTED**.

### Phase 14A acceptance-to-test correspondence

| Documented Phase 14A criterion | Passing evidence |
|---|---|
| Secure tokens are not client-readable; refresh rotation is serialized | `npm test -- admin-foundation.test.ts` — **1/1 PASS**; Admin foundation tests — **4/4 PASS** |
| Customer/Provider/Dispatcher cannot enter the Admin shell | `npm test -- auth.test.ts core.test.ts` — **2/2 PASS**; backend unit tests — **42/42 PASS** |
| English and Arabic shell tests pass | Admin foundation tests — **4/4 PASS** |
| Clean-schema API and Auth/Core regression gate | `npm test -- auth.test.ts core.test.ts` — **2/2 PASS** |
| Database integrity and repeatable environment setup | `npm run test:database` — **PASS**, **16 integrity assertions**; **7/7 migrations** apply successfully; seed verification — **PASS** |
| Required build/type validation | Backend build — **PASS**; Admin TypeScript — **PASS**; Admin production build — **PASS** |
| Required database dependency | Docker/PostgreSQL — **operational**; Docker/WSL blocker — **resolved** |

No Phase 14B functionality was implemented during the Phase 14A closeout. Customer and Provider functionality remains untouched.

## Engineering Phase 14B Admin Dashboard / Read Models / Governance checkpoint — COMPLETE

- Added a dedicated backend Admin read-model module with `GET /admin/dashboard`, filtered `GET /admin/bookings`, `GET /admin/audit-logs`, and `GET /admin/audit-logs/:id`. Dashboard counts and operational attention queues remain server-derived; the booking list uses a dedicated projection with customer/service/current-assignment/latest-payment fields only; audit list omits payloads and audit detail recursively redacts token, OTP/code, secret, credential, password, signature, payload, and device-token keys.
- Refined `GET /admin/users` and `GET /admin/users/:id/roles` to accept `identity:read` or `identity:manage`; identity provisioning, status changes, and grant revocation remain explicitly `identity:manage`. The existing `GET /bookings/:id` operational detail projection is reused for read-only Admin investigation.
- Added bilingual Admin dashboard, booking table/detail, users/grants, and audit list/detail screens. Screens use the existing server-only Admin session boundary, URL-backed read filters, safe links, loading/error/empty/forbidden handling, and Arabic RTL/English LTR layout. No Phase 14B mutation UI was added.
- No Prisma schema change or migration was required. Customer and Provider contracts, scopes, projections, and functionality remain unchanged; no production integration was added.
- Validation: focused fresh-schema real-PostgreSQL `admin-read-models.test.ts` — **1/1 PASS**; backend unit tests — **42/42 PASS**; relevant Auth/Booking/Dispatch/Payments/Settlements regressions — **5/5 PASS**; Admin tests — **7/7 PASS**; backend build — **PASS**; Admin TypeScript/typecheck — **PASS**; Admin production build — **PASS**; installed-engine Prisma schema validation — **PASS**.
- The standard root backend wrapper reached PostgreSQL but stopped before test discovery with Windows Prisma schema-engine `spawn EPERM`; the established direct runner applied unchanged migrations and ran the focused and regression suites successfully against fresh schemas. This is recorded as an environment/tooling limitation, not a Phase 14B defect.
- **Phase 14B is officially COMPLETE. Phase 14C–14H remain explicitly NOT STARTED.**

## Engineering Phase 14C Customers / Identity checkpoint — COMPLETE

- Added dedicated Admin-safe customer list/detail projections with bounded `status`, `locale`, and phone-prefix/name search filters; detail returns identity fields, address/property/booking counts, and at most ten safe recent booking summaries without exposing editable address/property records.
- Added bounded `status`, `role`, and phone-prefix/name search filters to `GET /admin/users`. Preserved read-versus-mutation authorization: user/grant reads accept `identity:read` or `identity:manage`; provisioning, status changes, and grant revocation remain `identity:manage`.
- Reused the existing transactional identity commands and exposed only same-origin Admin BFF command routes for provisioning, status changes, and grant revocation. The UI requires explicit confirmations for session-revoking actions, shows bilingual errors, and reloads authoritative backend projections after success.
- No arbitrary PATCH state changes, Customer/Provider app changes, production integrations, or schema migrations were introduced. Seven unchanged migrations applied successfully to a fresh PostgreSQL test schema and seed verification passed.
- Validation: fresh PostgreSQL `admin-customers.test.ts` **1/1 PASS**; backend unit suite **42/42 PASS**; focused Auth/Core regression **2/2 PASS**; Admin frontend tests **7/7 PASS**; backend build **PASS**; Admin TypeScript/typecheck **PASS**; Admin production build **PASS**.
- The standard Windows Prisma schema-engine wrapper remains subject to `spawn EPERM` before test discovery; the established direct runner was used for clean-schema validation and completed successfully. This is an environment/tooling limitation, not a Phase 14C defect.
- **Phase 14C is officially COMPLETE. Phase 14D–14H remain explicitly NOT STARTED.**

## Engineering Phase 14D Providers / Catalog checkpoint — COMPLETE

- Added the missing Admin-safe company detail projection: Admin-only commission and lifecycle fields, service areas, and server-derived counts for total/active teams, active company managers, open assignments, and unsettled payables.
- Extended Admin company and existing provider-team list reads with bounded server-side filters for status, name/internal code, company, active flag, and team status. The prior unfiltered provider team scope and safe provider projection are preserved; Customer/Provider mobile contracts were not changed.
- Added bilingual English/Arabic Admin pages for companies/detail/service areas, teams/detail/members/schedule/capabilities/status and scoped cleaner provisioning, services/extras, pricing rules and promotions. Existing audited transactions and Pricing idempotency are reused; successful mutations reload authoritative server projections. Loading, empty, error and forbidden states use the existing Admin foundation.
- Added a fixed same-origin Admin command BFF allowlist for Phase 14D provider/catalog/configuration writes and team-member provisioning. It forwards no client-readable bearer token and does not bypass NestJS authorization or DTO validation.
- No Prisma schema change or migration was required. No Customer Flutter, Provider Flutter, financial, booking/dispatch, notification/location-operations, or production-integration work was started.
- Validation: fresh PostgreSQL `admin-providers.test.ts` **1/1 PASS** with `node --env-file=.env scripts/test-backend-direct.mjs admin-providers.test.ts`; backend unit suite **42/42 PASS**; fresh-schema `core.test.ts pricing.test.ts provider-phase13d.test.ts` **14/14 PASS**; Admin tests **9/9 PASS**; backend build **PASS**; Admin typecheck **PASS**; Admin production build **PASS**; installed-engine Prisma schema validation **PASS**; direct clean-schema seed verification **PASS** (`Seed verified: 5 roles, 38 permissions, 2 catalog drafts.`).
- The standard `npm test -- admin-providers.test.ts` wrapper was attempted and blocked before test discovery by the Prisma engine download proxy (`ECONNREFUSED 127.0.0.1:9`). `npm run test:database` was attempted and blocked before assertions by the known Windows nested `spawnSync node.exe EPERM`. The direct clean-schema runner applied all seven unchanged migrations and completed the Phase 14D assertions.
- **Phase 14D is officially COMPLETE. Phase 14E–14H remain explicitly NOT STARTED.**

## Engineering Phase 14E Admin Bookings / Dispatch checkpoint — COMPLETE

- Added the Admin-only `GET /admin/bookings/:id` investigation projection. It returns bounded customer identity, service, immutable snapshots, assignment/company/team history and events, dispatch attempts, payment/refund/cash state, and booking status history without changing the customer/provider booking projection.
- Added the bilingual `/[locale]/operations/dispatch` screen with server-derived dispatch counts, recent attempts, and pending offers. The existing filtered Admin booking worklist remains the entry point for date/status/payment/customer/service/provider filters supported by its DTO.
- Added state-aware Admin actions for automatic offer, reasoned manual dispatch, pending-offer reassignment, retry assignment, explicit no-team terminal handling, cancellation, and defined team/customer no-show commands. Accepted/started reassignment is clearly unavailable. There is no arbitrary status PATCH.
- Added same-origin BFF allowlist entries for the Phase 14E commands. The browser never receives the backend bearer token; command keys are retained across transport retry for an unchanged payload, consequential actions require confirmation, 409 conflicts refresh the authoritative detail, and successful commands reload it.
- Reused existing Booking/Dispatch locks, eligibility/scoring, provider isolation, state transitions, idempotency, audit/history and outbox behavior. No Customer or Provider code, completed Admin 14A–14D behavior, or payment/settlement implementation was rebuilt.
- No Prisma schema change or migration was required. Direct clean-schema validation applied all seven unchanged migrations and seed verification passed: **5 roles, 38 permissions, 2 catalog drafts**.
- Validation: fresh PostgreSQL `admin-operations.test.ts` **1/1 PASS**; Booking/Dispatch/Provider/Payments/Settlements regression files **8/8 PASS** when run individually; backend unit tests **42/42 PASS**; Admin tests **11/11 PASS**; backend build **PASS**; Admin typecheck **PASS**; Admin production build **PASS**; `scripts/prisma-local.ps1 validate` **PASS**. The standard root test wrapper was attempted and blocked before test discovery by Prisma binary-download proxy refusal (`ECONNREFUSED 127.0.0.1:9`); `npm run test:database` was blocked by Windows `spawnSync node.exe EPERM`. The combined direct-runner regression command exposed a temporary-test cleanup race after all selected tests passed, so each regression was rerun individually with clean exits.
- **Phase 14E is officially COMPLETE. Phase 14F–14H remain explicitly NOT STARTED.**

## Engineering Phase 14F Admin Finance checkpoint — COMPLETE

- Added a dedicated Admin Finance backend projection module: filtered payment worklist/detail, safe payment attempts/status/event history, refund list/history, server-derived cash reconciliation worklist, and filtered settlement list/detail with company, payout, allocation and reconciliation information. Provider-safe settlement routes remain unchanged.
- Added bilingual Admin payments, refunds, cash and settlement pages with URL-backed filters, authoritative money/status display, empty/loading/error/forbidden states, and safe booking/customer/provider references. The browser does not calculate financial truth or receive backend credentials.
- Reused existing explicit commands for online retry, authorized refund, booking payment reconciliation/completion, and settlement calculation/review/approval/payout/reconciliation/close/cancel/reversal. Added only same-origin BFF allowlist entries; no arbitrary status patch or duplicate financial logic was introduced. Consequential commands confirm and reload authoritative data.
- Authorization remains separated: finance reads use `payment:read`, `refund:read`, `cash:read`, and `settlement:read` alternatives as documented; mutations continue to require `payment:manage`, `refund:manage`, `payment:manage` booking commands, or `settlement:manage`. Backend guards and existing provider/customer isolation remain authoritative.
- No Prisma schema change or migration was required. All seven existing migrations were applied to fresh PostgreSQL schemas and seed verification passed: **5 roles, 38 permissions, 2 catalog drafts**.
- Validation: fresh `admin-finance.test.ts` **1/1 PASS**; `payments.test.ts`, `settlements.test.ts`, `booking.lifecycle.test.ts`, and `provider-phase13d.test.ts` **4/4 PASS**; backend unit tests **42/42 PASS**; Admin tests **12/12 PASS**; backend build **PASS**; Admin TypeScript/typecheck **PASS**; Admin production build **PASS**; Prisma validation **PASS**. Existing regressions cover duplicate webhooks, refund idempotency, amount correctness, cash reconciliation, settlement allocation/reconciliation, locking, lifecycle, provider isolation, duplicate commands and audit histories.
- The standard Windows Prisma wrapper remains limited by the configured Prisma engine proxy (`ECONNREFUSED 127.0.0.1:9`) and nested `spawnSync node.exe EPERM`; the established direct clean-schema runner was used successfully for all live Phase 14F assertions.
- **Phase 14F is officially COMPLETE. Phase 14G and Phase 14H were not started. Phase 14A–14E were not rebuilt.**

## Engineering Phase 14G Admin Notifications / Locations checkpoint — COMPLETE

- Added the read-only Admin observability backend module with `GET /admin/notification-deliveries`, `GET /admin/notification-deliveries/:id`, and `GET /admin/operations/locations`. Notification filters cover delivery status, type, category, recipient, resource reference, and created-time range. Delivery projections include attempts, retry timing, failure information, provider references and persisted notification read/delivered state without device tokens or unrestricted payloads. Detail attempts expose delivery history and an allowlisted title/body/business-reference preview only.
- Added server-derived stored-location freshness projections for provider teams, company/team/status/freshness/location-availability filters, and existing service-area visibility. Freshness uses the dispatch `DISPATCH_LOCATION_MAX_AGE_MINUTES` configuration; the UI explicitly labels the data as stored reports, not live tracking. Location reads require platform Admin `admin:dashboard:read` plus `team:manage`.
- Added bilingual English/Arabic Admin notification list/detail and operations location pages with RTL/LTR rendering, URL-backed filters, loading/empty/error/forbidden states, operational delivery/freshness labels, safe booking links where a booking relation exists, and authoritative server reads. No BFF mutation route was added because these pages use the existing server-only Admin API boundary.
- No notification composition, arbitrary status mutation, retry/requeue command, outbox replay, production push, live GPS, fabricated coordinates, map provider, Customer/Provider code, or migration was added. Existing outbox materialization, delivery retry/idempotency, mock push behavior, device-token lifecycle, team location writes, dispatch freshness semantics, and authorization remain authoritative.
- Validation: fresh PostgreSQL `admin-observability.test.ts` **1/1 PASS**; `phase11.test.ts`, `dispatch.test.ts`, `provider-assignments.test.ts`, `provider-phase13d.test.ts`, and `booking.test.ts` **5/5 PASS** when run individually; backend unit tests **42/42 PASS**; Admin tests **15/15 PASS**; Admin typecheck **PASS**; backend build **PASS**; Admin production build **PASS**; direct clean-schema migrations and seed verification **PASS** (`5 roles, 38 permissions, 2 catalog drafts`); `scripts/prisma-local.ps1 validate` is the available Prisma validation path.
- The standard `npm run prisma:validate` command was attempted and remained environment-limited by the configured Prisma binary-download proxy (`ECONNREFUSED 127.0.0.1:9`). The direct clean-schema runner applied all seven unchanged migrations and passed the focused/regression assertions. No migration was created; migration `0007_phase11_notifications_location` remains latest.
- **Phase 14G is officially COMPLETE. Phase 14H was not started. Admin 14A–14F were not rebuilt.**

## Engineering Phase 14H End-to-End Hardening / Production Readiness checkpoint — COMPLETE

- Performed the final cross-surface hardening assessment against the repository implementation, existing tests, API contract, Prisma schema/seed, Admin permissions/BFF, Customer session lifecycle, Provider scope/commands, Booking/Dispatch state machines, Finance, Notifications and Locations.
- No concrete application defect was found. No backend, Flutter, Admin source, test, Prisma schema, or migration file required a change. Existing implementations were exercised using clean PostgreSQL schemas and the established direct runner, with Redis-backed readiness/notification checks where supported.
- Backend validation passed: unit suite **42/42**; clean-schema Auth/Core/Infrastructure **3/3**; Booking/Pricing/Lifecycle **14/14**; Dispatch/Provider **4/4**; Finance **2/2**; Admin read models **1/1**; remaining Admin/Phase 11 regressions **7/7**; separate-process Dispatch convergence/recovery **1/1**. Seven unchanged migrations applied and deterministic seed verification passed repeatedly (**5 roles, 38 permissions, 2 catalog drafts**).
- Frontend validation passed: Customer Flutter **56/56**, analyzer and Android debug build; Provider Flutter **73/73**, analyzer and Android debug build; Admin tests **15/15**, typecheck and production build.
- Cross-role authorization, financial invariants, replay/idempotency, concurrency/locks, terminal state protections, notification allowlists/outbox behavior, location freshness and Admin sensitive-field redaction were all covered by passing existing regression tests. No new security architecture or idempotency system was introduced.
- API documentation was reconciled with the current controllers, DTOs, permissions and BFF allowlist. No endpoint contract changed. Intentional mock/adapter boundaries remain explicitly documented: payment gateway, FCM/APNs, map/geocoding/routing, OTP delivery without production credentials, object storage, production secrets and multi-instance refresh coordination.
- The standard Prisma wrapper remains environment-limited by proxy refusal (`ECONNREFUSED 127.0.0.1:9`) and Windows nested `spawnSync node.exe EPERM`; Docker CLI access is unavailable in this shell. Installed-engine schema validation and the direct fresh-schema runner passed; this is not an application failure.
- Full detail is recorded in [phase14h-e2e-hardening-report.md](phase14h-e2e-hardening-report.md). No new feature phase or roadmap was started. Admin 14A–14G were not rebuilt.
- **Phase 14H is officially COMPLETE. This is the final Admin phase; stop after Phase 14H.**

## 2026-09-22 Docker/WSL environment repair attempt — HISTORICAL, SUPERSEDED

- `docker info`, `docker version`, `docker compose ps`, and `docker desktop status` could not reach the Linux engine; the configured `desktop-linux` context still points to the missing `npipe:////./pipe/dockerDesktopLinuxEngine` endpoint. `docker compose config` confirms the existing source of truth still binds PostgreSQL to `127.0.0.1:55432` and Redis to `127.0.0.1:56379`.
- `wsl --status`, `wsl -l -v`, and `wsl -d docker-desktop -- uname -a` all return `Wsl/Service/E_ACCESSDENIED`. `WslService` and `vmcompute` are running, but the current medium-integrity shell cannot open `WslService` to restart it. An elevation handoff via `Start-Process -Verb RunAs` failed before execution with Windows error `0xc0000142`.
- Docker's existing backend log records the actual engine failure: `DockerDesktop/Wsl/ExecError` while running `wsl-bootstrap` for `docker-desktop`, followed by backend shutdown with exit status `0x40010004`. The Docker Desktop data disk and repository were preserved; no WSL distribution was unregistered and no Docker volume or data directory was deleted.
- Restarting the two stale Docker Desktop user processes and launching Docker Desktop again did not help because WSL remained inaccessible. The PostgreSQL and Redis ports have no listeners. The requested `npm test -- admin-foundation.test.ts`, `npm test -- auth.test.ts core.test.ts`, and `npm run test:database` each stopped before test discovery with `ECONNREFUSED 127.0.0.1:55432`.
- Required manual host action: from an elevated PowerShell approved by UAC, run `Restart-Service WslService -Force`, then `wsl --shutdown`, verify `wsl --status` and `wsl -l -v`, and start Docker Desktop. After `docker info` succeeds, run `docker compose up -d postgres redis`, verify `docker compose ps` and both ports, then rerun the Phase 14A clean-schema gates. If the elevated service restart still returns `E_ACCESSDENIED`, reboot Windows and repeat the same verification before considering any further repair.
- The preceding repair attempt was superseded by the Phase 14A acceptance closeout above; the Docker/WSL environment blocker was subsequently resolved, all listed acceptance gates passed, and Phase 14A is **COMPLETE**. Phase 14B was later implemented and closed in the checkpoint above; Phase 14C–14H remain **NOT STARTED**.

## Phase 14 Admin Dashboard reconnaissance checkpoint — COMPLETE

- Confirmed `admin/nextjs` is still a minimal Next.js shell and that Phase 14 production implementation has not begun.
- Mapped the Admin plan to implemented NestJS controllers/services/projections and the current Prisma schema instead of older design aspirations.
- Classified every required Admin capability as reusable, projection/authorization work, missing, or deferred; specified the missing endpoint contracts and read-vs-mutation finance boundaries.
- Confirmed the planned Phase 14 scope requires no Prisma schema migration. Permission refinements can use existing persisted permission/grant tables and idempotent seed data.
- Defined implementation order 14A–14H and exact focused/full validation gates, including the known Windows Prisma `spawnSync node.exe EPERM` caveat.
- **Historical reconnaissance result:** ready to implement Phase 14A. Phase 14A was subsequently implemented, validated, and closed out as COMPLETE; Phase 14B was then started and is now complete in the checkpoint above, while Phase 14C–14H remain NOT STARTED.

## Engineering Phase 13D Provider Team Management + Financial Visibility checkpoint — COMPLETE

- Reused the existing Team domain for manager create/update/activation/capabilities and manager/cleaner status + availability operations; added only the missing scoped team-detail projection with stored location context.
- Added provider-only, read-only settlement list/detail projections. Flutter displays backend totals, payouts, completed-work context and reconciliation status without calculating money or exposing commission, calculation snapshots, allocations, payment/customer records, audit/history or dispatch data.
- Company manager company scope and cleaner exact-team scope remain server-enforced with foreign IDs returning 404; customers receive 403. Admin/dispatcher team permissions are unchanged. Admin settlement detail remains available on the legacy route; provider managers must use the safe provider projection.
- No migration, team-member identity provisioning, provider payout mutation, production integration, Admin Dashboard or Phase 14 work was introduced.
- Validation: backend build PASS, units **40/40**, focused clean Phase 13D **1/1**, clean domain regression **8/8**, isolated Phase 11 **1/1**, Provider Flutter **73/73**, analyzer/APK PASS, Customer Flutter **56/56**.
- **Phase 13D COMPLETE. Exact next: Phase 14 — Admin Dashboard. Do not start automatically.**

## Engineering Phase 13C Provider Job Execution checkpoint — COMPLETE

- Preserved the sole Booking graph: `TEAM_ACCEPTED → TEAM_ON_THE_WAY → CLEANING_STARTED → CLEANING_COMPLETED`; operational completion sets Assignment `COMPLETED`, while final Booking `COMPLETED` remains payment/proof gated.
- Added Provider Flutter active-job actions, server-derived action capability flags, immutable proof-metadata recovery, exact-amount cash collection, supported no-show actions, bilingual UI and same-key timeout retry followed by authoritative detail refresh.
- Start work now revalidates team/company operational state and service capability. Authorization tests cover manager company scope, cleaner exact team, foreign company/team, non-provider and arbitrary IDs with safe 403/404 behavior.
- Clean-schema concurrency validates single-winner start, completion, cash and no-show; same-key retries do not duplicate transitions, proofs, collections, audit/history or notifications.
- No migration, Dispatch redesign, Customer Flutter change, object upload, production gateway/push, live GPS, team/financial/settlement UI, Admin work or deployment was introduced.
- **Phase 13C COMPLETE. Exact next: Phase 13D (title/scope not defined in the repository). Do not start automatically.**

## Engineering Phase 13B Provider Operational Dashboard + Assignment Inbox checkpoint — COMPLETE

- Dedicated `GET /provider/assignments`, `GET /provider/assignments/:id` and cleaner-only `GET /provider/cash-worklist` enforce current persisted provider role/company/team scopes. Foreign assignment IDs are 404 and non-provider roles are 403.
- Dispatch offers now include safe target company/team identity. Assignment actions retain Booking-owned locking, idempotency, eligibility checks, history/audit and concurrency behavior; expired rejection now matches expired acceptance with 409.
- Flutter implements a server-backed dashboard, filtered inbox/history, assignment detail, accept/reject, accepted/active recovery, team/company context, cash alerts and notification-to-authoritative-detail navigation in separated layers with Arabic RTL/English LTR copy.
- No migration, Dispatch redesign, customer source change, job execution, cash mutation, provider finance UI, team management, production push or live location was introduced.
- **Phase 13B COMPLETE. Exact next: Phase 13C — Provider Job Execution. Do not start automatically.**

## Engineering Phase 13A Provider Flutter Foundation checkpoint — COMPLETE

- The pre-existing `mobile/provider_flutter` generated shell was retained and expanded into a provider-specific architecture. It is not coupled to or copied as Customer business logic.
- Only backend-returned `COMPANY_MANAGER` and `TEAM_LEADER_CLEANER` scopes enter provider routes. Customer-only, dispatcher-only and admin-only sessions reach access denied. Provider company/team responses are rechecked against current `/auth/me` scopes and fail closed on mismatch; NestJS authorization remains authoritative.
- Existing contracts modeled: Auth/session, provider companies, provider teams, dispatch offers, own-user notifications and company-scoped settlement summaries. Full assignment/job/team/cash/financial workflows remain out of scope.
- Required later backend gaps are documented: scoped assignment list/detail/recovery, manager-visible offer team attribution and a provider cash worklist/authoritative collection projection. No endpoint was invented or implemented.
- Validation: dependencies PASS; tests **37/37 PASS**; analyzer PASS; Android debug APK PASS. Customer regression was not required because Customer/shared code was unchanged. A debug APK is not a production readiness claim.
- **Historical Phase 13A checkpoint:** Phase 13A was complete and Phase 13B had not yet started. Current status is Phase 13C complete above.

Historical Phase 12E checkpoint: **Phase 12A–12E is complete for scoped customer-app acceptance.** The customer journey, session handling, command safety, error states, API contracts, Arabic/English localization, 56 Flutter tests, analyzer and Android debug build are validated. See [phase12-customer-app.md](phase12-customer-app.md).

Updated 2026-09-21 after Phase 12D Customer Booking Tracking + Notifications validation. The current checkpoint below supersedes historical checkpoint notes later in this document.

## Engineering Phase 12D Customer Booking Tracking + Notifications checkpoint — IMPLEMENTED AND VALIDATED

- Defined Phase 12D from existing customer contracts. Added a server-history booking timeline, safe assignment status, payment/refund display, paginated and grouped My bookings, a linked bilingual notification center and real-token device registration/invalidation client lifecycle. Home/booking/history/notifications use explicit and resume refresh without aggressive polling. No backend endpoint, schema or authorization was changed.
- Customer APIs consumed: `GET /bookings` with supported `limit/offset`, `GET /bookings/:id`, existing `POST /bookings/:id/cancel`, `GET /notifications` with `limit/offset`, `PATCH /notifications/:id/read`, and contract-ready `POST /devices`/`DELETE /devices/:id` when a real platform token is supplied. Payment/refund and assignment display read the existing booking detail projection. Notifications never supply authoritative Booking or Payment state.
- `flutter pub get` PASS; `flutter analyze` PASS with no issues; `flutter test` **56/56 PASS**; Android debug APK PASS. Isolated live Phase 11 backend acceptance rerun **1/1 PASS** in a disposable PostgreSQL schema.
- Limits: no customer-safe team location/freshness/ETA or team/member projection; no customer rating/review HTTP API despite the Rating table; no FCM/APNs token provider/credentials or production push; no authenticated Flutter-to-live-backend session or iOS build on Windows. Device registration is ready for a genuine platform token but cannot auto-register until that adapter exists. See [Phase 12 customer app record](phase12-customer-app.md).
- **Historical checkpoint: Engineering Phase 12D — Customer Booking Tracking + Notifications COMPLETE. Phase 12E is now complete; exact next phase is the Provider App.**

## Engineering Phase 12C Customer Booking Experience checkpoint — IMPLEMENTED AND VALIDATED

- Added the customer booking flow from service/extras through saved property and validated address, local date/time, server durable quote/review, backend booking confirmation, cash/online choice and authoritative details/status/cancellation. The existing backend contract was reused without backend edits.
- Added typed booking models, `BookingRepository`, `BookingRepositoryImpl`, `BookingController`, booking page/components and bilingual status/booking labels. Home and Services route into the real booking flow; Home links to booking details. Auth expiration clears sensitive customer/booking state.
- Quote totals/breakdown/expiry come only from `POST /bookings/quote`. Required Booking/Payment commands carry stable active-session idempotency keys; in-flight double taps are guarded and timeouts can retry the same key. Cash is shown as uncollected and online payment remains pending until the backend reports verified success. The current mock checkout URL is not opened.
- Validation: `flutter pub get` PASS; `flutter analyze` PASS with no issues; `flutter test` **38/38 PASS**; Android debug APK PASS with emulator API base URL. Existing isolated live backend Booking/Pricing/Payment acceptance passed **14/14** through the direct runner; standard Prisma wrapper stopped before assertions on the known blocked binary download.
- Backend gaps: no customer slot availability API or schedule input on quote; the backend checks future schedule at create and availability later in Dispatch. Current online provider is mock only. No authenticated live Flutter session, iOS build or durable idempotency key storage was validated. See [Phase 12 customer app record](phase12-customer-app.md).
- **Current phase: Engineering Phase 12C — Customer Booking Experience. Exact next sub-phase: Phase 12D (title/scope not yet specified in repository). Do not start it automatically.**

## Engineering Phase 12B Customer Core Experience checkpoint — IMPLEMENTED AND VALIDATED

- Added the customer bootstrap/session flow on top of the Phase 12A foundation: secure session restore, authenticated `/auth/me` validation, refresh-on-401, clean invalid-session logout, guarded routing, and branded splash/auth states.
- Implemented the existing OTP customer authentication flow with international phone validation, OTP verification, resend, loading, API/network errors, logout and session restoration. No alternate authentication flow was introduced.
- Added typed customer data models, repository/data-source layers and `CustomerController` state for profile, service catalog, addresses, bookings and notifications. The client consumes existing backend envelopes and never calculates authoritative prices.
- Implemented Home, Services/service details, Addresses CRUD plus server validation/default handling, Profile editing/logout/language preference, Notifications read state, and customer bottom navigation. Booking/payment routes remain intentional placeholders; no full booking or production gateway UI was started.
- Added localized English LTR and Arabic RTL UI strings for the new surfaces, including locale persistence through the existing `PATCH /customers/me` contract. Address creation uses the existing server validation/geocoding endpoint; no interactive map selector was added.
- Flutter validation: `flutter pub get` passed, `flutter analyze` passed with no issues, `flutter test` passed **14/14**, and Android debug build passed with `API_BASE_URL=http://10.0.2.2:3000/api/v1`.
- No backend files, migrations, or completed backend behavior were changed. No missing endpoint blocked this sub-phase. The existing backend has no service-category endpoint; the UI presents the supported flat service catalog and does not invent categories.
- Known limitations: booking flow, payment gateway UI, interactive map selection, device-token registration UI and Provider/Admin apps remain sequenced later. iOS was not built on Windows.
- **Current phase: Engineering Phase 12B — Customer Core Experience. Exact next sub-phase: Phase 12C — Customer Booking Experience. Do not start it automatically.**

## Historical Phase 12A Customer Flutter Foundation checkpoint

## Engineering Phase 12A Customer Flutter Foundation checkpoint — COMPLETE for scoped foundation

- Inspected the existing customer Flutter shell, backend API contract, architecture, payment/cash, settlement, and notifications/location records before implementation. The shell had no feature architecture, API client, secure session storage, routing, localization, or Dart tests.
- Added a production-oriented customer Flutter structure under `mobile/customer_flutter/lib` with separate presentation, application, domain, data/API, models, repositories, services, routing, and core utilities.
- Added environment-only `API_BASE_URL`, authenticated JSON API transport with structured errors, timeouts, safe GET retry, one-shot refresh-on-401, request IDs, and caller-supplied idempotency headers. Implemented the existing OTP/access-refresh/logout/me flow with `flutter_secure_storage`.
- Added guarded foundation routes for bootstrap, authentication, home, services, addresses, booking, booking details/tracking, payments, notifications, and profile; added reusable theme/widgets and Arabic RTL plus English LTR localization.
- Added **8/8** focused Flutter foundation tests. `flutter analyze` passed with no issues. `flutter pub get` passed. Android debug build passed and produced `build/app/outputs/flutter-apk/app-debug.apk`; iOS was not required on Windows.
- Full booking UI, production payment UI, maps, push credentials, Provider App, Admin Dashboard, and backend changes remain out of scope. See [Phase 12 customer app record](phase12-customer-app.md).
- **Current phase: Engineering Phase 12A — Customer Flutter Foundation COMPLETE. Exact next sub-phase: Phase 12B — Customer Core Experience. Do not start it automatically.**

## Engineering Phase 11 Notifications + Location checkpoint — COMPLETE for scoped backend acceptance

- Existing partial functionality was confirmed: customer-owned coordinate-required addresses, center/radius company areas, team location fields, immutable Booking location/address snapshots, and initial Notification/NotificationDelivery/DeviceToken/OutboxEvent tables. No application Location/Notification services or delivery worker existed.
- Added credential-free deterministic geocoding/reverse-geocoding abstractions, address validation/default ownership with concurrent protection, team location freshness updates, and preserved the existing Dispatch area/distance/scoring policy.
- Added NotificationModule outbox consumption, event-keyed history, read state, device token ownership/invalidation, mock push provider, retry/backoff, append-only delivery attempts and invalid-token cleanup. Booking/Dispatch/Payment/Cash/Refund/Settlement authoritative transitions now emit notification handoffs.
- Additive migration `0007_phase11_notifications_location` was applied to the configured PostgreSQL database with checksum `33ae1674370b28eb1c2de6ae7392d697693e73e0d10da69c7c6f7f0965eaf781`; migrations `0001`–`0006` were not rewritten. Redis returned PONG.
- Focused Phase 11 unit checks passed 3/3, expanded unit checks passed 40/40, and compiled live Phase 11 acceptance passed 1/1. Backend build and Prisma validation/client generation passed. The standard Prisma/test wrappers retain the known nested child-process `EPERM` limitation.
- See [Phase 11 record](phase11-notifications-location.md). Flutter, deployment and external maps/push adapters remain untouched.
- **Current phase: Engineering Phase 11 — Notifications + Location COMPLETE for the scoped backend acceptance. Exact next phase: Engineering Phase 12 — Customer Application. Do not start it automatically.**

## Phase 10 Settlements checkpoint — COMPLETE for scoped backend acceptance

- Added the explicit Settlement lifecycle: `DRAFT`, `CALCULATED`, `READY_FOR_REVIEW`, `APPROVED`, `PARTIALLY_PAID`, `PAID`, `RECONCILED`, `CLOSED`, plus explicit `CANCELLED` and `REVERSED` commands.
- Added locked, refund-aware calculation and immutable Payment-to-settlement allocation records. Provider payable snapshots preserve gross price, refunds, commission, online collection, cash collection and net payable; unique allocation constraints prevent double settlement.
- Added reconciliation evidence/results covering Booking → Payment → refund → cash → settlement payout, with explicit `MATCHED`/`DISCREPANCY` results and no silent correction.
- Added company-scoped reads, lifecycle/reconciliation/cancel/reverse APIs, append-only history/audit, idempotency and concurrency protection. Customers remain excluded from settlement data.
- Additive migration `0006_settlements_phase10` was applied to the configured local PostgreSQL database with checksum `513440db2a94fced3da0cb5a7f5cc1b4bbc5ba64c88a201f2c2fcf98a08aa295`; migrations `0001`–`0005` were not rewritten. Redis returned PONG.
- Focused live PostgreSQL acceptance passed 2/2, unit tests passed 37/37, and the exact compiled full backend regression passed 57/57 in a fresh six-migration schema. The direct runner was used for live validation because the known nested Prisma/Node wrapper EPERM remains.
- See [Phase 10 record](phase10-settlements.md). Flutter, Notifications and production deployment remain untouched.
- **Current phase: Engineering Phase 10 — Settlements COMPLETE for the scoped backend acceptance. Exact next phase: Engineering Phase 11 — Notifications + Location.**

## Phase 9 Payments + Cash checkpoint — COMPLETE

- Added the PaymentModule provider abstraction, local mock gateway adapter, online initiation/retry, signed server-verified webhooks, replay protection, amount/currency/reference checks, payment attempts/history, scoped payment reads, refunds, cash attribution/history and settlement commands.
- Preserved Booking as the sole Booking state owner and made no Dispatch behavior change. Existing Booking payment/cash/refund boundaries were strengthened with payment history, cash company/team attribution, collection transaction/audit and aggregate over-refund prevention.
- Additive migration `0005_payments_cash_settlement` is applied to the configured PostgreSQL database with matching checksum; migrations `0001`–`0004` were not rewritten. Redis returned PONG.
- Focused unit tests passed 37/37. Focused compiled live PostgreSQL payment/cash/refund/settlement acceptance passed 1/1. Exact full Auth/Core/Booking/Pricing/Infrastructure/Dispatch/Phase 9 regression passed 56/56 in a fresh five-migration schema.
- The real external gateway remains intentionally abstract/mock because no provider credentials or sandbox were available. Flutter remains untouched.
- `npm.cmd run test:database` still stops before assertions with nested `spawnSync node.exe EPERM`; this is the existing wrapper limitation. The compiled live suite and exact full backend suite passed.
- **Current phase: Engineering Phase 9 — Payments + Cash COMPLETE for the scoped backend acceptance.** Exact next phase from `prompt.txt`: Engineering Phase 10 — Settlements. It has not been started.

## Phase 8 Dispatch checkpoint — COMPLETE (historical)

- The backend DispatchModule has deterministic eligibility/scoring, policy snapshots, transactional Booking-owned offers/history/audit, scoped provider reads, monitoring, pending-offer reassignment, durable outbox events and capacity-safe locks. Legacy `/bookings/:id/assign` now shares the reasoned manual Dispatch policy and narrow operational response; the old direct Booking writer is removed. Terminal `NO_TEAM_AVAILABLE` and accepted/started manual reassignment reject with explicit 409 codes, preserving the master Booking graph. Operator reasons are retained in assignment, event, status history and actor-linked audit records. No migration, Pricing redesign, Flutter or financial mutation was introduced.
- Exact backend build and `npm.cmd run test:unit` passed 32/32. Targeted Dispatch and Booking regression tests passed 3/3. Separate-process worker validation passed 1/1 through `scripts/validate-dispatch-processes.ps1`: independent Node workers converged on one offer, recovered after termination, avoided duplicate work after restart, and sustained rejection/expiry/fault timer recovery. The exact full Auth/Core/Booking/Pricing/Infrastructure/Dispatch suite passed 50/50 through `npm.cmd test` on final source with fresh four-migration PostgreSQL and Redis.
- Prisma schema-engine/Node child execution remains intermittent: initial standard-wrapper attempts stopped before tests with proxy download refusal or installed-engine `EPERM`, and a later optional exact targeted rerun hit the proxy failure again. The exact full wrapper nevertheless completed successfully. The direct runner applies unchanged repository SQL and existing tests when child execution is blocked.
- Exact `npm.cmd run test:database` still stops before assertions with nested `spawnSync node.exe EPERM`. This is the existing wrapper limitation; the full live database suite passed. No architecture change was made to bypass it.
- **Current phase: Engineering Phase 8 — Dispatch COMPLETE for the scoped backend acceptance.** The required manual-policy, lifecycle, acceptance-time eligibility, concurrency, worker convergence/recovery and full regression gates passed. See [Phase 8 record](phase8-dispatch.md).
- Phase 9 is now complete; see [Phase 9 record](phase9-payments.md).

## Phase 7 acceptance checkpoint

- Implemented: versioned and audited declarative rule evaluation, fixed-amount promotions with transactional usage limits, durable immutable quotes, one-time quote consumption and the server-owned Booking handoff. Catalog-only behavior and Booking lifecycle/state/payment ownership remain intact.
- Validated final source after configured migration: PostgreSQL 16 and Redis PONG; backend build; exact `npm.cmd run test:unit` 28/28; exact `npm.cmd test` 45/45, including 11 Pricing acceptance subtests and all Auth/Core/Booking/Infrastructure regressions; configured database Pricing protections 7/7 in a rolled-back transaction; repeatable seed. The existing database checker assertion body passed 16/16 previously on an isolated migrated schema.
- `npm.cmd run test:database` still fails before assertions with nested Node `spawnSync node.exe EPERM`. `npm.cmd test` succeeds 45/45. No application or wrapper changes were made for the tooling restriction.
- Additive migration `0004_pricing_quotes` is applied to the configured public schema. The project's Prisma helper could not launch its schema engine, so the unchanged versioned SQL was applied transactionally after validating existing checksums and recorded in `_prisma_migrations` with its SHA-256 checksum. All four entries, quote/consumption tables, constraints and history triggers verify correctly. Native Prisma CLI status/deploy commands remain environment-blocked.
- Current phase: **Engineering Phase 7 — Pricing complete for the scoped backend acceptance gate.** Dispatch is next but has not started. Flutter remains later.
- Exact next step: begin Engineering Phase 8 Dispatch backend from the master specification and existing Booking assignment boundary. Track the exact database wrapper restriction separately. See [Phase 7 acceptance and contract](phase7-pricing.md).

## Project Status

**IMPLEMENTED** through backend infrastructure/authentication, Core Domain, Booking lifecycle boundaries, Pricing domain requirements, scoped Phase 8 Dispatch, Phase 9 Payments + Cash and scoped Phase 10 Settlements acceptance. Current environment limitations and later dependencies are in the checkpoint above. Historical validation reports remain in [codex-changelog.md](codex-changelog.md).

The master specification is preserved as the approved architecture and historical Phase 12A record. The continuation calls database integration “Phase 13”; the existing changelog calls this engineering Phase 3. Engineering Phase 13 in `prompt.txt` instead means Provider Flutter. Use phase names as well as numbers.

## Architecture

Flutter customer/provider shells, NestJS modular monolith, Next.js admin shell, PostgreSQL/Prisma and Redis. Backend owns business state, authorization and money. PrismaService/DatabaseModule, connection lifecycle, configuration, health checks and real persistence already exist. No in-memory repository needs replacing in these implemented modules.

## Repository Structure

| Location | Actual content |
|---|---|
| `backend/nestjs/src` | Database, Redis, config, HTTP handling, health, auth, Core Domain and Booking modules |
| `backend/nestjs/test` | Infrastructure, auth, core and Booking integration tests; independent unit checks under `unit/` |
| `database/prisma` | Domain schema, seed and five versioned migrations; all five recorded with matching checksums in the configured database |
| `mobile/customer_flutter`, `mobile/provider_flutter` | Completed scoped Customer application and Phase 13A Provider foundation, each with Android/iOS/web platform scaffolding and Flutter tests |
| `admin/nextjs` | Next.js shell and TypeScript/build scripts |
| `scripts` | Environment/bootstrap, WSL services, database/integration/foundation checks and local Prisma helper |
| Root | npm workspaces/lockfile, Compose, ignored private environment, original specification/UML/instructions |

Git exists, but all project files were untracked at session start. No committed source baseline was available for a meaningful diff. Existing source and migration history were retained.

## Implemented

- Database: identities/scopes, customers/properties/addresses, providers/teams, catalog, bookings/snapshots/history, assignments, finance, notifications, support, audit and outbox.
- Infrastructure: Prisma/Redis lifecycle providers, validated environment, health routes, request IDs, safe HTTP envelopes, DTO validation, Helmet and CORS.
- Authentication: phone OTP, expiry/attempt limits, Redis rate limits, hashed opaque sessions, rotation/replay revocation, logout and live role/scope checks. Local OTP file delivery and an unvalidated Twilio adapter exist.
- Core: seven domain areas retain their existing persistence and now use application services throughout; customer administration, company profiles, extras/areas updates, team management/schedules, role revocation, pagination and explicit response projections are implemented. Privileged changes are transactionally audited. See [Phase 5 record](phase5-core-domain.md).
- Booking backend: customer-owned creation/reads, append-only snapshots, server-owned quote handoff validation, explicit payment confirmation/reconciliation/refund boundaries, assignment/job/no-show/proof/cash boundaries, complete transition graph, status history/events, audit records, row locks and idempotency are implemented. Pricing and Phase 9 payment/cash integration are live-validated; real gateway and storage dependencies remain later work. See [Phase 6 record](phase6-booking.md) and [Phase 9 record](phase9-payments.md).
- Pricing: versioned rules, audited administration, fixed-amount promotions, immutable durable quotes and transactional Booking handoff are implemented. See [Phase 7 record](phase7-pricing.md) for policy details, validation and deployment gate.
- Dispatch complete for the scoped backend gate: eligible-team discovery, score/rank with configurable weights and approximate ETA, Booking-owned offer creation, PostgreSQL-polling retry/expiry worker, durable outbox handoff, reasoned manual assignment/reassignment, acceptance-time status/capability rechecks, provider-scoped offer reads, monitoring, concurrency protection and separate-process recovery validation. See [Phase 8 record](phase8-dispatch.md).
- Payments + Cash complete for the scoped backend gate: provider abstraction/mock adapter, verified webhooks, attempts/history, cash collection attribution/reconciliation, refunds and separate provider settlement records. See [Phase 9 record](phase9-payments.md).
- Customer Flutter 12A–12E and Provider Flutter 13A–13D are implemented and regression-validated, including session lifecycle, authoritative refresh, provider/company/team scope, job execution, cash boundaries, localization and RTL/LTR behavior.
- Admin 14A–14G provide the authenticated bilingual dashboard, identity/customer/provider/catalog/booking/dispatch/finance/notification/location/governance surfaces and explicit backend-owned commands. Admin 14H completed the final hardening validation without rebuilding those phases; see [Phase 14H report](phase14h-e2e-hardening-report.md).
- Continuation improvements: standalone `npm run test:unit`; installed-engine helper `scripts/prisma-local.ps1`; documentation synchronized with source.

## Partially Implemented

The completed Backend 5–11, Customer 12A–12E, Provider 13A–13D and Admin 14A–14H scopes are validated by their focused suites and final hardening run. Phase 14H exact evidence is 42/42 backend unit tests, 32/32 fresh-schema integration tests across clean groups, 1/1 separate-process Dispatch recovery, Customer 56/56, Provider 73/73 and Admin 15/15, plus analyzer/typecheck/build gates. The database wrapper limitation remains a separate tooling issue.

## Not Implemented

Credentialed production payment gateway, FCM/APNs delivery, map/geocoding/routing provider, object storage, live SMS, settlement bank rails, ratings/support APIs, CI/CD, production secrets, multi-instance coordination, production soak and operational calibration remain deployment/integration responsibilities or intentionally out of scope. The repository-supported Admin/mobile workflows and Phase 14H hardening are complete; no new feature roadmap follows this phase.

## Historical validation status — preceding checkpoints

| Check | Status and observed evidence |
|---|---|
| Prisma schema | **VALIDATED**: local-engine helper ran schema validation successfully |
| Prisma client | **VALIDATED**: helper generated client 6.19.3 |
| Backend TypeScript | **VALIDATED**: backend build passed, including `test:unit` prerequisite build |
| Unit checks | **VALIDATED**: 22 passed, 0 failed; 21 existing Core Domain/foundation cases plus one Booking state-machine case |
| Flutter dependencies/analyzers | **VALIDATED**: offline dependency resolution and analysis passed in both projects |
| Flutter customer web | **VALIDATED**: web build passed |
| Flutter provider web | **VALIDATED**: web build passed |
| Flutter tests | **BLOCKED**: neither project has test files |
| Admin TypeScript | **VALIDATED**: standalone typecheck passed |
| Admin full build | **BLOCKED**: compiled successfully, then worker launch failed with `spawn EPERM` |
| WSL startup | **BLOCKED**: `Wsl/Service/E_ACCESSDENIED` reproduced on 2026-09-20 |
| PostgreSQL/Redis | **VALIDATED**: authenticated PostgreSQL query; Redis PING and temporary set/get passed |
| Migration status/deploy/seed | **PARTIAL**: exact Prisma status/deploy/seed commands remain blocked by schema/seed child-process `spawn EPERM` or the blocked engine-download proxy; the three repository migration SQL files were applied transactionally with checksums recorded, and the seed script passed twice directly |
| Database integrity/full backend tests | **VALIDATED**: 16 database integrity assertions passed; latest exact `npm.cmd test` passed 29/29 against a fresh migrated/seeded schema, including Pricing quote, original and lifecycle Booking coverage. `npm.cmd run test:database` remains blocked before assertions by nested Prisma `spawnSync node.exe EPERM` |
| Foundation HTTP smoke | **PARTIAL**: infrastructure acceptance passed inside the live suite; standalone smoke remains blocked because its child-process launcher cannot start services |

Full command results: [validation-2026-09-19.md](validation-2026-09-19.md).

## Known Problems

- Current runtime restricts some nested Node/Prisma child processes and engine downloads. PostgreSQL and Redis are reachable. Exact test/status/deploy wrapper results vary by invocation; use the current checkpoint above. No direct application/database assertion failure remains.
- Initial Prisma validation attempted a blocked download. Installed engine hash `c2990dca591cba766e3b7ef5d9e8a84796e47ab7` works for schema validation/client generation via the new helper.
- Historical note superseded: Customer now has 56 tests and the Provider Phase 13A foundation has 37 tests; both Android debug builds pass. iOS still requires macOS and was not built on Windows.
- No real payment gateway or maps, push or object-storage integration is validated; Phase 9 is validated against the local mock provider and signed webhook contract.
- Core entity lists support bounded limit/offset pagination and explicit field projections. Offset pages are not snapshots across concurrent changes. Live ownership, locking, rollback, session revocation and HTTP regressions pass.

## 2026-09-20 Pricing boundary validation

- Added the first Pricing backend boundary at `POST /api/v1/bookings/quote` without changing Booking state ownership or adding a migration.
- The endpoint validates customer-owned inputs, uses transaction-stable catalog reads, returns an expiring customer-facing `catalog-v1` quote, and shares its formula with Booking creation.
- `npm.cmd run build:backend` passed; `npm.cmd run test:unit` passed 24/24; exact `npm.cmd test` passed 29/29.
- A standalone new test file hit the same Node test-runner spawn restriction, so its assertions were folded into the existing Booking integration suite; no application workaround was added. The separate database wrapper remains blocked before assertions by direct child-process `EPERM`.

## 2026-09-20 Booking continuation validation

- Added and live-validated the Booking-side quote, payment, assignment/job, proof, no-show, cash, reconciliation, completion and refund boundaries without changing the schema or migrations.
- `npm.cmd test` passed 27/27, including the original Phase 5 regression suites, original Booking coverage and the new lifecycle suite. `npm.cmd run test:unit` passed 22/22. Backend build passed.
- `npm.cmd run test:database` still fails before its assertions with nested Prisma `spawnSync node.exe EPERM`; this is an environment wrapper limitation. It is distinct from the passing live application/database assertions.
- Booking logic remains preserved; the current engineering phase has advanced to the Pricing backend foundation. Flutter, full Pricing, separate Dispatch and full Payments remain not started.

## Architectural Conflicts

- Early cash diagrams pass through booking PAYMENT_CONFIRMED; later sections 60/109 dispatch cash before collection. The Booking boundary now keeps selection, trusted cash authorization, collection and reconciliation separate; cash selection never implies receipt. Future Payments/Dispatch integration must preserve this contract.
- The existing schema resolves early per-booking versus later batch settlement as ProviderPayable plus Settlement/SettlementItem/SettlementPayment. Preserve that decision.
- Money retains specified DECIMAL(12,2), despite JOD supporting three decimal places. Do not silently change historical precision.
- The original missing-artifact audit is obsolete: foundation, auth and core source exist. Do not recreate them.

## Current Phase

**Historical checkpoint: Production Decisions Audit complete before Phase 15A.** Phase 14A–14H, Phases 5–11, Customer 12A–12E, and Provider 13A–13D remain complete. Current Phase 15 status is at the top of this file. See the [Phase 14H report](phase14h-e2e-hardening-report.md) and [production-decisions.md](production-decisions.md).

## Final Stop Point

Phase 14H implementation and validation closeout and the read-only Production Decisions Audit are complete. Stop before Phase 15 or production integration. Obtain explicit owner decisions for launch scope, platform baseline, providers and credentials before implementation. Multi-instance BFF refresh coordination, production external integrations, deployment secrets and operational soak remain limitations documented in the final report and decision audit.

## 2026-09-20 infrastructure recovery and live Phase 5 validation

- `.\scripts\start-local.ps1` reproduced `Wsl/Service/E_ACCESSDENIED`; WSL service enumeration also returned `E_ACCESSDENIED`.
- PostgreSQL and Redis are reachable at `127.0.0.1:55432` and `127.0.0.1:56379`; direct authenticated query, Redis PING and set/get passed. WSL remains inaccessible, and Docker/psql/redis-cli are not available.
- Prisma status/deploy and Prisma seed were attempted with the installed engine. Status/deploy fail before database work with schema-engine `spawn EPERM`; normal seed also attempts the blocked proxy download, while the installed-engine seed path fails to spawn `tsx`.
- The three unchanged repository migrations were applied transactionally to the configured database with SHA-256 checksums recorded; the seed script passed twice directly with 5 roles, 30 permissions, 32 grants and 2 inactive services.
- Backend build and `npm.cmd run test:unit` passed; the 21-test unit suite remains green. Direct database integrity validation passed 16 assertions.
- The live compiled HTTP/database suite passed 3/3: authentication, Core Domain ownership/permissions/concurrency/rollback/snapshot/revocation cases, and infrastructure readiness. Temporary validation schemas were removed afterward.
- Exact `npm.cmd run test:database` and `npm.cmd test` were rerun and remain blocked before assertions by `spawnSync node.exe EPERM` and Prisma engine download/child-process restrictions. Phase 5 application acceptance passes; the exact wrapper gate remains blocked.

The historical notes above predate the completed Phase 8 checkpoint at the top. Current exact `npm.cmd test` passes 50/50; separate-process worker validation passes 1/1; native Prisma status/deploy and the separate `test:database` wrapper remain environment-blocked.
