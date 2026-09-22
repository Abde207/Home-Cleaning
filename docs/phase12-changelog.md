# Phase 12 foundation changelog

## 2026-09-19 — Phase 5 Core Domain continuation

- Preserved the current repository, database integration, schema/migrations and completed Phase 12A checks. No Flutter, booking-engine or pricing-engine work.
- Extracted user/catalog/company/team persistence into application services. Added admin customer reads, company provider profile, extras/area updates, team metadata/schedule management and identity-role revocation.
- Completed role/resource scope checks, cleaner own-team availability, dispatcher operational reads, explicit response projections and bounded list pagination.
- Added transactional audits and row locks for privileged updates; serialized duplicate identity provisioning and replace-all team capabilities. Role revocation also deactivates membership and revokes sessions.
- VALIDATED: backend TypeScript build, 21 independent tests (19 new Core Domain checks), test syntax checks.
- IMPLEMENTED, NOT LIVE VALIDATED: expanded HTTP/database tests for ownership, rollback, concurrency, snapshots and revocation. BLOCKED: PostgreSQL refused 127.0.0.1:55432; Redis connect/PING unavailable; database and integration runners never reached assertions.
- Database/dependencies: no schema, migration, seed, package or lockfile changes. API changes and exact file list: [Phase 5 record](phase5-core-domain.md) and [API contract](api.md).
- Remaining/next: restore existing services/runtime access, execute live foundation and Core Domain acceptance tests, fix failures, record results. Remain in Phase 5 until it passes.

## 2026-09-19 — Existing foundation validation continued

- Preserved the existing Flutter/NestJS/Next.js repository, Prisma schema and migrations `0001_init`, `0002_integrity`, `0003_session_rotation`.
- Added a Windows Prisma helper that uses installed engine binaries when automatic download is unavailable. Schema validation and client generation passed through the helper.
- Made the two existing environment/provider-scope unit checks runnable independently of live dependencies and the TypeScript subprocess loader. Both passed on freshly compiled backend code; full integration runner retains them.
- Backend compilation, admin standalone TypeScript, and both Flutter dependency/analyzer/web build checks passed.
- Live PostgreSQL/Redis, migrations, seed, database constraints/seed contents and HTTP/integration verification remain BLOCKED in the current runtime. WSL access and required child process launches were denied. Full Next.js build also encountered `spawn EPERM`.
- No schema or migration modification, deployment, external purchase, real OTP delivery or application feature redesign occurred.

The prior foundation/database implementation history is preserved in [codex-changelog.md](codex-changelog.md). Current claims use the commands/results in [validation-2026-09-19.md](validation-2026-09-19.md).
