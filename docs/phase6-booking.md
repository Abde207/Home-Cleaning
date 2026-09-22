# Phase 6 — Booking backend implementation record

Updated 2026-09-20. Engineering phase numbering follows `prompt.txt`.

## Phase 8 integration update

Dispatch selects/ranks teams and hands offers into BookingService's transactional assignment command; Booking remains the sole owner of status and assignment history. A PostgreSQL-polling worker reuses that boundary for rejected/expired offers and writes null-actor system history plus durable outbox handoffs. Provider acceptance rejects expired/non-operational offers and teams that lose required capability, and common offer creation rechecks team capacity under a team lock. The legacy `/bookings/:id/assign` route now uses the same reasoned Dispatch manual policy, exact Booking slot check, narrow response and Booking transaction as the new route. `NO_TEAM_AVAILABLE` remains terminal; accepted/on-the-way/started jobs cannot be manually reassigned without a new explicit Booking lifecycle. Scoped Phase 8 acceptance, including separate-process worker recovery, is complete; notification delivery remains a later dependency. See [Phase 8 record](phase8-dispatch.md); the older validation totals below describe the Booking checkpoint, not the current 50/50 suite.

## Phase 7 integration update

The Pricing dependency now evaluates versioned rules/promotions and persists immutable quotes. Booking creation consumes an owned quoteId (or creates/consumes a fresh quote for existing callers) in its existing idempotent transaction. Historical source/extra/price snapshots, promotion usage, unique consumption, audit/history and Booking creation commit together. Confirmation and the Booking state machine are unchanged. Migration 0004 is applied to the configured database, and exact `npm.cmd test` passes 45/45 including Booking lifecycle regressions. See [Phase 7 record](phase7-pricing.md). The initial implementation sections below describe the earlier catalog-only checkpoint.

## Objective and status

Implement the Booking backend without rebuilding Phase 5 and without starting Flutter, Pricing, Dispatch, or full Payments. The initial slice and the remaining dependency-bound lifecycle commands are **IMPLEMENTED and live-validated**. Booking remains **PARTIALLY IMPLEMENTED** until the future Pricing, gateway, dispatch-worker and storage dependencies are integrated and the remaining isolated-environment validation gate passes.

The latest `npm.cmd test` passed 29/29 after the Pricing quote boundary was added. `npm.cmd run test:database` remains environment-blocked by nested Prisma `spawnSync node.exe EPERM` before assertions. That is an execution-wrapper limitation, not an application/database integrity failure; compiled live tests and direct database/Redis checks remain the acceptance evidence.

## Existing functionality found before implementation

- Prisma already contained `Booking`, `BookingExtra`, `BookingPriceSnapshot`, `BookingStatusHistory`, `Assignment`, `Payment`, `IdempotencyKey` and related historical/financial tables.
- Phase 5 already owned customer, address, property, service and service-extra persistence, authorization, projections and audit helpers.
- No Booking controller, service, module, command route or booking tests existed.
- No Pricing, Dispatch, online Payments, refund, settlement, notification or mobile Booking implementation was present.

No existing Booking application behavior was duplicated.

## Implemented backend slice

### CreateBooking

`POST /api/v1/bookings` requires a customer session and `Idempotency-Key`. The backend derives the customer from the authenticated identity and verifies that the service is active and the property/address belong to that customer and are not archived.

The transaction captures:

- address and coordinates;
- property details;
- service identity, names, description, base price and duration;
- selected active extras, quantities and unit prices;
- a backend-generated booking number;
- estimated end time from the captured service duration;
- a `catalog-v1` price snapshot using service base price plus selected extras.

The current catalog quote is a minimal Booking dependency, not the Phase 7 Pricing Engine. No discounts, fees, property rules, promotions or configurable pricing rules are calculated yet.

The booking starts at `REQUESTED` with an initial status-history row and `BOOKING_CREATED` audit record. Booking extras and the price snapshot are immutable historical records from the API perspective; later catalog/address/property changes do not rewrite them.

### Explicit commands

- `POST /bookings/:id/confirm` — `REQUESTED` → `PRICE_CONFIRMED`.
- `POST /bookings/:id/select-cash` — `PRICE_CONFIRMED` → `CASH_SELECTED`, creating a separate `Payment` cash-selection record. This is only the booking/payment boundary; cash collection and reconciliation remain deferred.
- `POST /bookings/:id/cancel` — explicit cancellation from states permitted by the state machine, with optional reason.

### Continuation boundaries

- `POST /bookings/:id/quote-confirmed` is restricted to `pricing:manage`, validates server-owned money arithmetic and requires an exact match to the existing append-only quote snapshot before `PRICE_CONFIRMED`. It does not mutate historical pricing; dynamic quote persistence belongs to the future Pricing phase.
- `POST /bookings/:id/start-online-payment`, `payment-confirmed` and `cash-payment-confirmed` create or update separate Payment, PaymentEvent and PaymentTransaction records only through trusted operational boundaries.
- `POST /bookings/:id/assign` is a dispatcher/admin handoff that validates team/company/service capability and creates Assignment/AssignmentEvent/DispatchAttempt records. Candidate discovery and dispatch workers remain out of scope.
- `/assignments/:id/accept`, `reject`, `on-the-way`, `start-cleaning`, `complete-cleaning`, `completion-proof`, `team-no-show`, `customer-no-show` and `collect-cash` implement explicit provider job boundaries with assignment and booking scope locks.
- `start-payment-reconciliation`, `reconcile-payment`, `complete`, `refund` and `refund-completed` implement reconciliation, proof-gated completion and trusted refund boundaries.

There is no arbitrary booking status PATCH endpoint. Every implemented command locks the booking row, checks current state and scope, updates the booking version, appends status history, writes an audit record, and stores an idempotent response in `IdempotencyKey`.

### Reads and scope

- `GET /bookings` returns customer-owned bookings or platform operational bookings for actors with `booking:operations`.
- `GET /bookings/:id` returns only an owned or operationally authorized booking.
- Foreign customer resources resolve as not found; client-supplied customer/company/team ownership is never trusted.
- Responses use explicit projections and include historical snapshots, extras, the price snapshot and status history for detail reads.

### State machine boundary

The complete documented transition graph is encoded in `booking.state.ts`, including terminal and exception states. Implemented commands expose only explicit transitions; no arbitrary status PATCH exists. Full candidate selection, gateway verification, settlement and media storage remain external dependencies.

## Concurrency and consistency

- Create/confirm/cash/cancel commands require bounded idempotency keys.
- Idempotency operations use a PostgreSQL transaction advisory lock keyed by actor, operation and key. Replays return the stored response; a reused key with a different request returns `409 IDEMPOTENCY_KEY_REUSED`.
- Mutable Booking commands take a PostgreSQL row lock before validating and updating state.
- Booking, Payment cash intent, status history, audit and idempotency records commit in the same transaction.
- Historical address/property/service/extra values are stored at creation and are not read back from mutable current records for detail snapshots.

## Validation evidence

- Backend TypeScript build passed.
- `npm.cmd run test:unit` passed **22/22** at the Booking checkpoint; the later Pricing foundation raises the current unit total to **24/24**, including deterministic quote calculation checks.
- The compiled live suite passed **4/4** against a fresh isolated migrated/seeded schema: existing authentication, existing Core Domain, infrastructure readiness and the new Booking integration test.
- Booking integration coverage passed ownership isolation, concurrent same-key creation and assignment without duplicate rows, quote snapshot protection, payment event/transaction separation, cash collection, proof gating, assignment/job transitions, rejection/retry, both no-show flows, refund completion, state history and invalid transition rejection.
- Existing Phase 5 live acceptance remained green; the latest exact `npm.cmd test` run passed 29/29, including the Pricing quote assertions.

The database wrapper remains blocked before assertions by the documented nested Prisma process limitation; this does not invalidate the passing live application suite.

## Not started in this phase

- Full Pricing Engine and configurable quote rules.
- Full Pricing Engine and dynamic quote/version persistence.
- Gateway acquisition, webhook signature verification, provider retry/failure semantics and settlement.
- Dispatch candidate discovery/reassignment/expiry workers and production scheduling.
- Object-storage media, notifications, maps/location providers and Flutter UI.

## Remaining Booking work / exact next step

Booking lifecycle logic and the Pricing handoff are implemented and live-validated. Migration 0004 is deployed. Remaining Booking dependencies are future payment/dispatch/storage integrations. Scoped Phase 7 backend acceptance is complete; Dispatch is next but has not started. Preserve the existing Booking commands in later integrations; Flutter remains later.
