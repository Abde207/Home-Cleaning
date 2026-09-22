# Phase 5 — Core Domain implementation record

Updated 2026-09-20 after live validation. Engineering phase numbering follows `prompt.txt`; the master document's original Phase 5 describes finance and is a different numbering system.

## Objective and status

Continue the existing seven Core Domain areas without rebuilding the foundation or entering bookings, pricing, dispatch or Flutter UI. The scoped implementation below is **IMPLEMENTED**. Backend compilation, independent tests and live Phase 5 HTTP/database acceptance are **VALIDATED**. The exact npm/Prisma wrapper commands remain **BLOCKED** only by the documented environment nested-process restriction; this does not invalidate Phase 5 or require rebuilding it. The next engineering phase is Booking.

## Requirements and implementation

| Area | Implementation |
|---|---|
| Users | Existing admin provisioning/status management extracted into UsersService; role listing/revocation added. Concurrent duplicate provisioning serialized by phone advisory lock and user row lock. Cleaner membership and session revocation share the role-removal transaction. |
| Customers | Existing own profile preserved; admin customer summary list/detail added behind customer:read. Explicit profile projection excludes roles/sessions. |
| Addresses / properties | Existing server-derived ownership, DTO validation, replacement and soft archive retained. Added bounded pagination. No writes to historical booking snapshots. These domains remain grouped in CustomersService because they share the customer ownership boundary. |
| Services / extras | Public active catalog preserved in CatalogService. AdminCatalogService owns catalog mutations; extra listing/update/deactivation added. Explicit decimal/field projections and transactional audits. No quote calculation or pricing engine added. |
| Companies / areas | CompaniesService owns privileged company management and area create/list/update/deactivation. Scoped provider company read/profile update added; manager profile writes name only. Dispatcher read projection excludes commission. |
| Teams | TeamsService owns create/update/activation, scoped members, availability create/list/update/remove, status and capabilities. Cleaner can operate own availability/status; manager/admin controls metadata/capabilities. Dispatcher is read-only. |
| API boundary | Controllers delegate to application services; Prisma is the existing persistence adapter. Explicit selection allowlists prevent new model columns silently entering responses. |
| Lists | Entity lists accept limit 1–100 and offset 0–1000000, preserving existing array responses. Stable ordering, server-side ownership filters. Complete role/capability sets are unpaginated. |
| Audit/concurrency | Privileged configuration writes include actor, request ID and projected before/after data in the same transaction. Row locks serialize team configuration and mutable administrative records; capability replacement cannot interleave into a merged set. |

## Decisions and limits

- Preserve the existing CoreModule and shared schema. No migration or dependency changes are required. Existing migrations were not edited.
- Parent IDs are checked on nested updates (service/extra, company/area, team/availability, user/grant), preventing reparenting via a URL.
- Provider identity creation and membership grants remain admin-approved, following master section 102. Company managers cannot grant themselves or others roles. Member removal uses audited identity-role revocation.
- Cleaners use their existing job:team grant for own-team availability operations, consistent with the provider use-case diagram. No seed permission changes are needed.
- Dispatcher company:read/team:read grants allow operational reads, not mutation or commission access.
- Team company/internal code cannot be reassigned by the metadata update route. Company activation/commission remains platform administration.
- Removing availability deletes schedule configuration and keeps the audit; it does not delete assignments or operational history. Overlap precedence/dispatch eligibility belongs to Phase 8 and is not invented here.
- Deactivating catalog/area/team data retains historical relations. Monetary precision stays DECIMAL(12,2). Availability requires an explicit timezone and persists UTC timestamps.
- Existing in-flight authorized requests may finish when an administrator changes scope; subsequent requests use the existing live guard. Offset pagination is not a snapshot across concurrent changes.
- No new endpoint promises Idempotency-Key replay. Provisioning reuses identities/grants under concurrent retries; audits may repeat. Other create commands remain non-deduplicated.

## Validation evidence

`npm.cmd run test:unit` passed a fresh backend TypeScript build and **21 tests**, including the two previously existing foundation tests and 19 Core Domain tests. New checks cover scope composition, dispatcher read-only policy, privileged route metadata, pagination, response selections, DTO/precision/timezone validation, customer ownership predicates, invalid provisioning scopes, foreign-team denial, cleaner operation boundaries, interval rejection, transaction sequencing, audit error propagation and role/member/session revocation sequencing.

Unit persistence adapters are test doubles. These checks do **not** establish actual database rollback, HTTP authorization, row-lock behavior or end-to-end correctness.

The expanded `test/core.test.ts` contains live HTTP/database cases for:

- customer/provider isolation, admin and dispatcher permissions, pagination and parent-child validation;
- active/inactive catalog extras, company area updates and provider profile projection;
- concurrent duplicate provisioning, cleaner scope, schedule lifecycle and UTC handling;
- failed capability replacement rollback, concurrent replacement without set merging;
- actual audit FK failure rolling back service creation, identity provisioning, user status/session changes and capabilities;
- saved-address/property archive preserving existing booking snapshots;
- company/team deactivation scope filtering, user suspension/session revocation, reactivation without token revival and role/member revocation.

Syntax checks passed. The exact `npm.cmd test` and `npm.cmd run test:database` wrappers still stop before assertions because Node cannot spawn nested processes (`spawn EPERM`) and the normal Prisma path attempts the blocked proxy download. Equivalent live assertions were executed directly against an isolated migrated/seeded schema and passed; Redis PING and set/get also passed. Earlier WSL E_ACCESSDENIED remains an environment blocker, not an application failure.

## Files changed

- Updated core files: `core.dto.ts`, `core.module.ts`, `customers.controller.ts`, `customers.service.ts`, `users.controller.ts`, `services.controller.ts`, `providers.controller.ts`.
- New core files: `users.service.ts`, `catalog.service.ts`, `admin-catalog.service.ts`, `companies.service.ts`, `teams.service.ts`, `core.policy.ts`, `core.projections.ts`.
- Tests: expanded `backend/nestjs/test/core.test.ts`; added `backend/nestjs/test/unit/core.test.mjs`.
- Documentation: this record, `api.md`, `architecture.md`, `codex-implementation-status.md`, `codex-changelog.md`, `phase12-changelog.md`, `validation-2026-09-19.md`.
- Build output refreshed under ignored `backend/nestjs/dist`. No Flutter/admin source, schema, migration, package or lockfile change.

## Remaining work / exact next step

The Phase 5 live cases for ownership, rollback, concurrency, snapshots and revocation executed and passed. Preserve this implementation and proceed with the Phase 6 Booking backend. The exact Prisma/npm wrappers should be rerun when nested child-process access is available, but their environment limitation does not block Booking work. Pricing is Phase 7.

## 2026-09-20 live validation evidence

PostgreSQL and Redis were already running and healthy. The three unchanged migrations were applied transactionally with recorded checksums; direct seed execution passed twice. The direct database integrity check passed 16 assertions. The compiled live suite passed all 3 Phase 5 tests, including the full Core Domain acceptance path. `npm.cmd run test:database` and `npm.cmd test` were rerun but remain blocked before assertions by nested Node/Prisma process restrictions. Phase 5 was accepted and handed off to the Booking phase; no Phase 5 rebuild was performed.

## 2026-09-20 Phase 6 handoff

Phase 5 is live-accepted. The exact npm/Prisma wrapper failures are documented as environment-only `spawn EPERM` limitations. Booking implementation proceeds on the existing schema and Core Domain boundaries; the Phase 5 services, projections, authorization and audit helpers remain the source of truth.
