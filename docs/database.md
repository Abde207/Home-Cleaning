# Database

Updated 2026-09-21. Schema/client validation passes. Migration 0007 is applied to the configured public database; migrations 0001–0006 remain unchanged. Phase 11 compiled live acceptance passed 1/1; the standard wrapper remains subject to the known nested Prisma/Node `spawn EPERM` limitation.

## Existing migration history

| Migration | Responsibility |
|---|---|
| `0001_init` | Domain tables, enums, foreign keys, indexes and uniqueness |
| `0002_integrity` | Checks, ownership/scope FKs, NULLS NOT DISTINCT role uniqueness, active assignment uniqueness, GiST overlap exclusion, immutable snapshots and append-only records |
| `0003_session_rotation` | Session family ID and rotation/replay index |
| `0004_pricing_quotes` | Immutable PricingQuote, unique/owner-bound QuoteConsumption, and immutable rule/promotion terms; activation/usage remain mutable |
| `0005_payments_cash_settlement` | Payment attempts, payment/refund/settlement histories, verified webhook metadata, cash collector attribution and Settlement versioning |
| `0006_settlements_phase10` | Settlement lifecycle, immutable Payment allocations, calculation snapshots and reconciliation evidence |
| `0007_phase11_notifications_location` | Address defaults/geocoding metadata, event-keyed notifications, delivery retry/history, device-token invalidation and delivery indexes |

Existing migrations 0001–0003 were not edited/reset/deleted. Migration 0004 is additive and required for unconsumed quote persistence. Prisma's installed schema-engine child launch failed with EPERM, so the unchanged 0004 SQL was executed in one controlled PostgreSQL transaction after checking prior ledger checksums; its checksum/success were recorded in `_prisma_migrations`. The new tables, constraints and four Pricing protection triggers were verified. Schema changes require new migrations. SQL uses PostgreSQL 15+ features; the configured PostgreSQL is 16.15 and requires `btree_gist`.

UUIDs, UTC TIMESTAMPTZ, JOD DECIMAL(12,2) amounts and restrictive deletion follow the specification. Separate ProviderPayable and settlement batches/items/payments preserve the existing financial model decision.

## Seed

The transactional seed upserts five roles and the permission catalog in `seed.ts`, adds missing grants and creates two inactive zero-price drafts: REGULAR_CLEANING and DEEP_CLEANING. Existing service configuration is not overwritten. Extra grants are not removed; this is additive bootstrap, not permission reconciliation. The historical count of thirty permissions predates `identity:manage`; verify actual counts against the current seed/live data.

## Commands from root

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run prisma:status
npm.cmd run prisma:deploy
npm.cmd run prisma:seed
npm.cmd run test:database
npm.cmd test
```

When Windows engines are installed but download access is unavailable, use `scripts/prisma-local.ps1 validate` (or generate/status/deploy/seed). It sets engine paths for the invocation, preserves caller overrides and restores the previous environment afterward. It does not grant process/service access.

The database test creates a uniquely named disposable schema, applies migrations, seeds twice and exercises 16 integrity assertions, then drops only that schema. Its exact wrapper remains environment-blocked before assertions. The 16 unchanged assertion body passed previously on an isolated schema. After configured migration deployment, the exact backend wrapper passed 45/45 and the configured database passed seven direct Pricing checks inside a fully rolled-back fixture transaction. Seed ran twice directly on the configured database; 5 roles and 30 permissions were verified. Its 16 total service rows include existing services and the two seed drafts.

The configured PricingQuote/QuoteConsumption, payment/cash, settlement, location and notification tables and restrictions are present. Native Prisma deploy and the exact database wrapper may be rerun when the environment can launch child processes; no application architecture change is needed for this tooling issue. Phase 11 scoped backend acceptance is complete; the exact next phase is Engineering Phase 12 Customer Application, which has not been started.
