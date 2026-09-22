# Home Clean — saved progress and continuation handoff

Updated 2026-09-20 after configured database deployment and live acceptance. The implementation and policy details below remain the Phase 7 handoff; earlier blocked-command results are historical checkpoints.

## Current Phase

**Engineering Phase 7 — Pricing: complete for the scoped backend acceptance gate.** Migration 0004 is applied to the configured database and recorded in Prisma's migration ledger. Full live regression passed 45/45 after deployment. The separate `test:database` wrapper still cannot launch nested Node (`spawn EPERM`); its underlying 16 integrity assertions passed previously on a disposable migrated schema, and seven additional Pricing checks passed on the configured database this turn.

Continue from these files. Do not restart Phase 5, Booking or Pricing. Dispatch is the next engineering phase; it has not been started. Flutter remains later in the sequence.

Sequence remains Booking → Pricing → Dispatch → Payments/Settlements → Notifications/Maps → Admin → Flutter → final testing/production.

## Implemented

### Existing behavior preserved

- Phase 5/Auth/Core/Infrastructure and Booking lifecycle implementation remain in place.
- Booking owns state transitions, confirmation commands and historical financial snapshots.
- No arbitrary booking-status update route was introduced.
- Historical address/property/service/extra values and payment separation remain intact.
- Existing catalog calculation remains the Decimal baseline; callers without quoteId still work.

### Versioned PricingRule evaluation

- Reuses existing `PricingRule(name, version, definition, active, startsAt, endsAt)` model.
- Admin APIs publish increasing versions and explicitly activate/deactivate rules, with permissions, audit and required idempotency keys.
- Definitions are validated declarative data, never executable expressions.
- Supports ADJUSTMENT/FEE with FIXED, PER_SIZE, PER_ROOM, PER_BATHROOM, PER_MINUTE and PERCENT_SUBTOTAL bases.
- Optional service/property-type/inclusive-size predicates.
- Highest active, currently effective version per name is selected before predicates; names are sorted deterministically.
- Each line uses Decimal HALF_UP rounding to the existing two-decimal precision. Percentages use base + extras without compounding.
- Signed adjustments are allowed; fees and final total are nonnegative. Amounts must fit existing money columns.
- Rule IDs, names, versions, definitions and evaluated amounts are stored in the quote breakdown. Applied rules receive a `rules-v1:<hash>` fingerprint; no-rule baseline retains `catalog-v1`.
- Published rule definitions/windows cannot be edited or deleted; new terms require a higher version.

### Promotions

- Reuses the existing fixed-amount Promotion model and promotion:manage permission.
- Audited/idempotent publication and activation APIs.
- One optional uppercase promotion code per quote; active window, minimum subtotal and optional global maximum uses are checked.
- Discount caps at subtotal, including zero-total bookings.
- Quote issuance does not consume or reserve uses.
- Successful Booking creation consumes one use under a row lock in the same transaction as the booking and quote consumption.
- Same-key retries do not consume twice; concurrent last-use claims produce one success and one conflict.
- A REQUESTED booking consumes the promotion. Cancellation does not automatically restore capacity. Published terms are immutable; new terms require a new code.

### Durable quotes and server-owned handoff

- `PricingQuote` stores owner, verified inputs, source snapshots, extras and their historical unit prices, full pricing breakdown, promotion reference, creation time and expiry.
- Quotes are immutable at the PostgreSQL level and remain available to their owner for history.
- TTL is five minutes, shortened to promotion expiry when needed.
- Issuance accepts an optional Idempotency-Key for compatibility; a supplied key replays the same quote and expiry. Omitted keys create distinct records.
- Booking creation accepts optional quoteId and promotionCode with the existing booking inputs.
- Supplied quotes are checked for ownership, matching inputs, expiry, current source ownership/activation and one-time use; historical quoted values are copied rather than recalculated.
- Without quoteId, Booking invokes the same current rule/promotion evaluation transactionally, so omission cannot bypass fees or adjustments.
- QuoteConsumption enforces one quote → one booking and matching customer ownership through unique/composite database constraints.
- Booking creation, quote consumption, promotion usage, historical snapshots/status history, audit and idempotency commit or roll back together.
- Quote expiry gates consumption. After consumption, the Booking snapshot remains valid; the existing explicit confirm command still performs REQUESTED → PRICE_CONFIRMED.
- Booking creation audit request IDs now hash the idempotency key, supporting the full permitted 128-character key without exceeding the audit column length.

## API routes reached

All routes are relative to `/api/v1`.

| Route | Permission / purpose |
|---|---|
| POST /bookings/quote | booking:own; create durable server-priced quote; optional key |
| GET /bookings/quotes/:id | booking:own; read own immutable quote |
| POST /bookings | Existing customer command, now accepts quoteId/promotionCode; required key |
| GET /admin/pricing/rules | pricing:manage; bounded list |
| POST /admin/pricing/rules | pricing:manage; publish immutable increasing version; required key |
| POST /admin/pricing/rules/:id/activation | pricing:manage; activation only; required key |
| GET /admin/promotions | promotion:manage; bounded list |
| POST /admin/promotions | promotion:manage; publish immutable terms; required key |
| POST /admin/promotions/:id/activation | promotion:manage; activation only; required key |

Customers cannot submit totals, discounts, ownership fields or rule definitions. Existing privileged `/bookings/:id/quote-confirmed` remains a validator of the already stored historical snapshot; customer handoff uses quoteId.

Full DTOs/error codes: [API documentation](api.md). Detailed evaluation/consumption policy: [Phase 7 implementation](phase7-pricing.md).

## Database migration state

- Existing migrations `0001_init`, `0002_integrity`, `0003_session_rotation` were preserved.
- Added `0004_pricing_quotes/migration.sql`, with matching Prisma schema models.
- Adds PricingQuote and QuoteConsumption, expiry/ownership/uniqueness protections, immutable quote/consumption triggers, and rule/promotion term-protection triggers.
- No existing data is dropped or rewritten. Rule activation and promotion activation/uses remain mutable.
- The migration was necessary because a pre-booking quote cannot be represented by the existing unique per-booking BookingPriceSnapshot.
- Prisma schema validation initially identified missing composite unique declarations for the one-to-one relations; these were fixed before the first migration deployment. Validation/client generation then passed.
- All four migrations deployed successfully via Prisma to an isolated schema in the earlier 42-test wrapper run.
- All four migration SQL files also applied transactionally in final direct disposable-schema validation.
- **Configured application database:** before deployment, 0001–0003 had matching repository checksums. After the existing Prisma helper failed to launch its schema engine (`spawn EPERM`), the unchanged `0004_pricing_quotes/migration.sql` was executed in one controlled PostgreSQL transaction, with the checksum and successful completion recorded in `_prisma_migrations`. All four entries now have matching repository checksums, finished timestamps and no rollback marks. `PricingQuote` and `QuoteConsumption`, their FKs/checks, and all four Pricing history/terms triggers were verified on the configured public schema.
- No migration reset, old migration edit, database recreation or primary-data cleanup was performed.

## Validated

| Check | Final evidence |
|---|---|
| Prisma schema validation | PASS |
| Prisma Client generation | PASS, 6.19.3 |
| Backend TypeScript build | PASS |
| Unit command | 28/28 PASS |
| Final direct live/unit suite | 45/45 PASS |
| Pricing live acceptance | 11 subtests PASS within the above total |
| Existing database integrity assertions | 16/16 PASS via the unchanged assertion body on a disposable schema |
| Seed repeatability | PASS; 5 roles, 30 permissions, 2 catalog drafts |
| Phase 5/Auth/Core/Infrastructure/Booking regressions | PASS |
| PostgreSQL/Redis readiness | PASS in current live regression tests |
| Earlier exact npm test checkpoint | 42/42 PASS before the final three Pricing acceptance subtests were added |
| Current exact `npm.cmd test` after configured deployment | **45/45 PASS**, including 11 Pricing acceptance subtests and all Booking/Phase 5 regressions |
| Current `npm.cmd run test:unit` | **28/28 PASS**, with a fresh backend build |
| Configured database Pricing checks | **7/7 PASS** for quote immutability, expiry, rule/promotion term protection and permitted activation/usage changes; all fixtures rolled back |
| Configured migration ledger and seed | 0001–0004 checksums match; seed passed twice, 5 roles and 30 permissions; 16 total service rows include preexisting services and the seeded drafts |

Pricing acceptance covers scope and price-injection rejection, every rule basis, deterministic version selection, windows/activation, Decimal rounding/bounds, promotion minimum/expiry/deactivation/capping, immutable database history, quoted-value preservation after catalog/rule changes, source activation, quote expiry/input mismatch, duplicate/concurrent consumption and last promotion use.

Fault injection rejected a late BOOKING_CREATED audit insert after financial writes. The transaction rolled back booking/snapshots/history, promotion use, quote consumption, audit and idempotency. Retrying the same key after removing the injected fault succeeded. Expected 500/503 test logs came from this fault test and the existing readiness failure test.

## Not Yet Validated

- Exact `npm.cmd run test:database` wrapper completion in a runtime without the known nested process restriction.
- Native Prisma CLI status/deploy execution in this runtime; ledger and schema were verified directly after applying the versioned migration SQL.
- Production commercial pricing configuration/operational acceptance; no commercial rule values or active promotions were seeded.
- Later Dispatch/payment gateway/settlement/storage/client integration, which is outside this phase.

## Blocked

The known environment restriction recurred during final checks:

- Default Prisma attempted an engine checksum download and failed through the blocked proxy (`ECONNREFUSED 127.0.0.1:9`).
- Selecting the installed engine reached schema-engine child-process `spawn EPERM`.
- `scripts/prisma-local.ps1 status` and `deploy` still fail before database inspection because the installed schema-engine child launch returns EPERM. Versioned migration 0004 was applied and recorded through the controlled PostgreSQL migration path described above.
- `test:database` retains its known nested Node/Prisma wrapper limitation; one exact rerun after deployment failed before assertions with `spawnSync node.exe EPERM`.

These tooling failures occur before database assertions. They do not negate the successful configured deployment and exact 45/45 live backend test. Application architecture and checked-in wrappers were not modified to bypass the limitation.

## Tests / Commands

Executed in this continuation:

```powershell
.\scripts\prisma-local.ps1 validate
.\scripts\prisma-local.ps1 generate
npm.cmd run build:backend
npm.cmd run test:unit
npm.cmd test
.\scripts\prisma-local.ps1 status
npm.cmd run prisma:deploy
```

The subsequent deployment continuation verified PostgreSQL 16 and Redis PONG, ran `scripts/prisma-local.ps1 validate`, attempted `status` and `deploy`, applied the unchanged migration SQL transactionally with ledger recording after those commands hit EPERM, verified schema/ledger/trigger state, seeded twice directly, ran `npm.cmd run test:unit` (28/28), ran `npm.cmd test` (45/45), and attempted `npm.cmd run test:database` (blocked before assertions). A seven-check configured database fixture transaction was rolled back in full.

At the preceding checkpoint, an npm test retry with installed Windows engine paths failed before assertions with EPERM. This continuation's exact `npm.cmd test` passed 45/45. No environment file was rewritten.

Direct final validation used temporary `.local/phase7-live-validation.mjs`: current test TypeScript was transpiled in-process, imports pointed at current compiled backend modules, repository migrations were applied transactionally to a fresh local `test_<uuid>` schema, seed ran repeatedly, the unchanged database-checker assertion body ran, and all existing/new suites ran. Both direct runs passed 45/45; the last also passed 16 integrity assertions. Its test schema and temporary script were removed after validation. Test source remains in the repository for the normal runner.

At the preceding checkpoint, a read-only inspection found the two new tables absent. After the controlled 0004 deployment, a new read-only inspection verified both tables and all four matching ledger checksums. No database URL or credentials are recorded here.

## Files Changed

Application source modified:

- `backend/nestjs/src/pricing/pricing.calculation.ts`
- `backend/nestjs/src/pricing/pricing.dto.ts`
- `backend/nestjs/src/pricing/pricing.controller.ts`
- `backend/nestjs/src/pricing/pricing.module.ts`
- `backend/nestjs/src/pricing/pricing.service.ts`
- `backend/nestjs/src/booking/booking.dto.ts`
- `backend/nestjs/src/booking/booking.module.ts`
- `backend/nestjs/src/booking/booking.service.ts`

Application source added:

- `backend/nestjs/src/pricing/pricing.rules.ts`
- `backend/nestjs/src/pricing/pricing.admin.service.ts`
- `backend/nestjs/src/pricing/pricing.transaction.ts`

Schema/tests:

- Modified `database/prisma/schema.prisma`
- Added `database/prisma/migrations/0004_pricing_quotes/migration.sql`
- Modified `backend/nestjs/test/unit/pricing.test.mjs`
- Added `backend/nestjs/test/pricing.test.ts`

Generated Prisma client and backend build output were refreshed. No package/dependency, Flutter, Dispatch, or Payments/Settlements implementation changes were made. The repo began with all project files untracked; there is no committed baseline for a meaningful git diff or status-based change inventory. Do not reset or discard those files. No commit was created.

## Documentation Updated

- [Implementation status](codex-implementation-status.md)
- [Changelog](codex-changelog.md)
- [Phase 7 Pricing implementation](phase7-pricing.md)
- [Phase 6 Booking integration update](phase6-booking.md)
- [API contract](api.md)
- [Architecture](architecture.md)
- [Database/migration notes](database.md)
- [Validation record](validation-2026-09-19.md)
- This consolidated handoff: `docs/phase7-pricing-handoff-2026-09-20.md`

## Remaining Pricing Work

No known unimplemented requirement remains in the scoped rule/promotion/durable-quote/Booking-handoff backend. The configured migration and required database/live acceptance passed. Keep the exact database wrapper limitation tracked as tooling debt; it does not reopen Phase 7. Future production policy calibration remains a separate operational gate.

## Exact Next Step

Start Engineering Phase 8 — Dispatch backend by reading the master dispatch specification, this handoff, the current Booking assignment boundary and the existing schema. Preserve the Pricing and Booking contracts, then implement candidate eligibility/scoring, offer lifecycle and worker/expiry behavior with live tests. Do not start Flutter. Rerun the exact `test:database` wrapper when the execution environment permits nested Node; do not change application architecture for that tooling issue.
