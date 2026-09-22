# Phase 7 — Pricing backend

Updated 2026-09-20. Requirements: master specification §§57, 117, Phase 12A migration rules, and `prompt.txt` Engineering Phase 7.

## Status

Rule evaluation, promotions, durable quotes and transactional quote-to-booking integration are implemented and live-validated. **Phase 7 scoped backend acceptance is complete after migration 0004 was applied and verified on the configured database.** Dispatch is the next engineering phase but has not started; Flutter remains later.

After configured deployment, exact `npm.cmd test` passed **45/45**, including 11 Pricing acceptance subtests and all Booking/Auth/Core/Infrastructure regressions. `npm.cmd run test:unit` passed **28/28**. The existing database checker assertion body passed **16/16** previously on a disposable migrated schema; seven configured database Pricing integrity checks passed in a rolled-back transaction. Exact `npm.cmd run test:database` still fails before assertions with nested Node `spawn EPERM`, a separate environment limitation.

## Existing architecture reused

- `Service` / `ServiceExtra` remain the catalog baseline, calculated with the existing Decimal helper.
- Existing `PricingRule(name, version)` and `Promotion` models are retained; their JSON rule definition and existing fixed-amount promotion columns are now implemented.
- Booking remains the sole owner of state transitions, history and the append-only `BookingPriceSnapshot`.
- Existing authentication permissions, audit records and PostgreSQL advisory-key idempotency patterns are reused.
- Existing Payment/Refund/Settlement tables and Booking lifecycle transitions are unchanged.

## Rule contract

Administrators with `pricing:manage` can publish increasing versions and explicitly activate/deactivate records. Definitions and their effective windows cannot be edited or deleted; changes require a new version. Writes are audited and require `Idempotency-Key`.

`definition` is validated data with no executable expressions:

| Field | Contract |
|---|---|
| `kind` | `ADJUSTMENT` or `FEE` |
| `basis` | `FIXED`, `PER_SIZE`, `PER_ROOM`, `PER_BATHROOM`, `PER_MINUTE`, `PERCENT_SUBTOTAL` |
| `amount` | Decimal text, at most 10 integer and 2 fractional digits; adjustments may be signed; fees nonnegative |
| `serviceId` | Optional service UUID filter |
| `propertyType` | Optional APARTMENT/HOUSE/VILLA/OFFICE filter |
| `minSize`, `maxSize` | Optional inclusive Decimal size bounds; min <= max |

Selection uses server issuance time: active records in `[startsAt, endsAt)` (null end is unbounded), highest eligible version per name, then service/property predicates. Names are sorted for deterministic output. Deactivating a newer version can make an older still-active version eligible again; deactivate all versions to disable a rule family. A future version does not replace the current version before its start time.

Each rule line rounds Decimal arithmetic HALF_UP to the existing two-decimal schema precision. Percentage rules use base + extras and never compound. Duration uses captured service duration, not client-provided duration. Aggregates must fit DECIMAL(12,2), and subtotal/total cannot be negative. Invalid stored definitions fail closed.

```text
customer_total = base_service_price + extras + adjustments + fees - discount
```

These rule precedence, rounding, percentage-base and promotion-consumption semantics are explicit implementation choices where the master spec leaves details open. No commercial amounts or active rules are seeded.

`catalog-v1` identifies the no-rule baseline. Applied rules yield `rules-v1:<SHA-256>` with exact rule IDs, names, versions, definitions and evaluated amounts stored in the immutable breakdown. Promotions are recorded separately in the same breakdown, including their ID/code/terms and applied discount.

## Promotions

`promotion:manage` can publish immutable terms and activate/deactivate codes. One optional exact uppercase `promotionCode` applies per quote. The existing model supplies a fixed amount, minimum subtotal, optional global usage limit and `[startsAt, endsAt)` window. Discounts are capped at subtotal (zero-total bookings are supported); no stacking or invented percentage-promotion schema is introduced.

Issuing a quote does not reserve or increment uses. Booking creation rechecks activation/window/capacity under a promotion row lock, increments uses once and writes `PROMOTION_REDEEMED` in the Booking transaction. Concurrent claims for the final use produce one success and one `409 PROMOTION_UNAVAILABLE`.

A successfully created REQUESTED booking consumes the promotion; cancellation does not automatically restore capacity. Replays do not consume again. Abandoned quotes consume nothing. Changing promotion terms requires a new code; deactivation can prevent consumption of an outstanding promotional quote.

## Durable quotes and handoff

`POST /bookings/quote` now persists an append-only `PricingQuote`, including server-derived customer ownership, verified inputs, complete source snapshots, historical extra unit prices, exact price/breakdown, optional promotion reference and expiry. TTL remains five minutes and is shortened to a promotion's end time where needed. `GET /bookings/quotes/:id` reads the stored response for its owner, including expired or consumed quotes for history.

Quote issuance accepts optional `Idempotency-Key` for compatibility with the existing endpoint. Supplied keys serialize/replay the original stored result; mismatched input returns 409. Omitted keys create distinct quotes. Replaying an expired quote issuance does not renew it; use a new key for a fresh quote.

`POST /bookings` accepts optional `quoteId` and `promotionCode` alongside its existing service/property/address/extras/schedule fields. To consume a promotional quote, repeat its promotion code and identical inputs. Extra ordering is normalized. Totals, discounts, rule definitions and customer ownership fields are never accepted from the client.

When `quoteId` is supplied, Booking locks the owned quote, verifies input equality, one-time use, expiry and current source ownership/activation, then copies the quote's stored service/property/address/extra/price values. Catalog price or address edits do not reprice that quote. The historical service duration determines estimated end time. Schedule is separately validated as a future instant; this rule language does not use schedule-based prices.

For existing callers without `quoteId`, the same Pricing service issues and consumes a fresh durable quote within the Booking transaction, including all applicable rules. Omitting a quote cannot bypass adjustments or fees. Legacy catalog-only results remain unchanged when no rules or promotion apply.

Booking starts at REQUESTED. Existing explicit confirmation moves it to PRICE_CONFIRMED; payment selection uses its historical amount. No new generic status command exists. Expiry gates consumption into the booking; a consumed booking snapshot is not invalidated by later quote expiry.

## Transactions and migration

Additive migration `0004_pricing_quotes` is required because neither `PricingRule` nor the unique per-booking snapshot can store an unconsumed durable quote. It adds:

- `PricingQuote`, with customer/promotion FKs, expiry check and immutable snapshot/history trigger;
- `QuoteConsumption`, with unique quote and booking IDs, composite owner FKs and append-only history;
- term-protection triggers on existing rules/promotions, permitting only activation and promotion usage changes.

Migrations 0001–0003 were not changed. Migration 0004 passed Prisma deploy in an isolated schema and was applied to the configured public schema using its unchanged repository SQL in one controlled PostgreSQL transaction when Prisma's schema-engine child process returned EPERM. The application migration ledger records 0001–0004 as finished with matching SHA-256 checksums. The new tables, constraints and immutable-history/terms triggers were inspected and seven direct configured database checks passed. Native Prisma CLI status/deploy remains a tooling limitation, not an unapplied migration.

Rule publication/activation and quote issuance use exclusive/shared configuration advisory locks. Source records use share locks; quote consumption and promotion redemption use row locks. Extras are locked in deterministic ID order. Booking writes, snapshot/history, quote consumption, promotion usage, audits and idempotency commit or roll back together. An injected late audit failure verified complete rollback and successful same-key retry. Full 128-character Booking creation idempotency keys are represented by a bounded hash in audit request IDs.

## Acceptance coverage

- Catalog compatibility and Decimal rule arithmetic for every basis, including signed adjustments, rounding, overflow/negative rejection and predicates.
- Rule version selection, future/expired/inactive exclusion, activation, duplicate/racing publications, audit and permissions.
- Promotion minimums/windows/caps, zero-total capping, deactivation, and concurrent last-use claims (both explicit and inline quotes).
- Durable reads/ownership, strict price injection rejection, unchanged quote/source history after catalog/rule changes, PostgreSQL immutability.
- Expiry and mismatch rejection, concurrent same/different-key consumption, exact-once usage, financial separation and existing Booking confirmation/cash selection.
- Late audit failure rollback, retry safety and all existing Phase 5/Booking lifecycle regressions.

## Acceptance and exact next step

The scoped Pricing domain and required database/live acceptance have passed. Exact `npm.cmd run test:database` and native Prisma CLI status/deploy remain environment-blocked before assertions/database work; their limitation is recorded separately from the passing checks. Begin Engineering Phase 8 Dispatch backend with the master specification and existing Booking assignment boundary. Do not start Flutter. See the [current handoff](phase7-pricing-handoff-2026-09-20.md).
