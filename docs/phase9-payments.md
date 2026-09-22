# Engineering Phase 9 — Payments + Cash

Updated 2026-09-21. **Complete for the scoped backend acceptance.** No Flutter UI or production deployment work was started.

## Existing boundary reused

Phase 6 already owned the Booking payment commands and the finance tables: `Payment`, `PaymentTransaction`, `PaymentEvent`, `CashCollection`, `Refund`, `ProviderPayable`, `Settlement`, `SettlementItem` and `SettlementPayment`. Phase 9 preserved those boundaries and strengthened them rather than adding a second booking/payment state machine. Phase 8 Dispatch was not changed.

## Implemented

- `PaymentModule` with a provider interface and deterministic local `mock` adapter. The adapter creates checkout references and refund references; it is intentionally not a real gateway.
- `POST /payments` creates or reuses a server-owned online Payment, records a PaymentAttempt, calls the provider abstraction, and returns a checkout URL/reference. The client cannot set success.
- `POST /payments/:id/retry` creates a new attempt only for a failed online payment in `PAYMENT_PENDING`.
- `POST /webhooks/payments/:provider` verifies the raw request with an HMAC signature, maps the signed provider reference to a PaymentAttempt/Payment, checks amount and currency, records the verified event, and transitions Booking only for a verified success. Provider event uniqueness and payload hashes protect replays and mismatched duplicates.
- Online failures remain retryable and do not confirm the Booking. Amount/currency mismatch is recorded as a rejected verified event and does not confirm the payment. Unknown provider references are rejected.
- Existing customer payment reads are now available through `GET /payments/:id`, with customer ownership and provider/admin scope enforcement. Sensitive provider credentials are never returned.
- Existing cash selection/authorization/collection/reconciliation commands remain in Booking. Collection now records company/team attribution, a collection transaction, payment history and an audit record. The existing unique CashCollection payment relation and status checks prevent duplicate collection.
- `POST /payments/:id/refunds` supports online provider refunds and cash-policy pending refunds. Refund history, provider/reference data, Payment status, Booking state, idempotency and aggregate over-refund checks are recorded. Partial refunds produce `PARTIALLY_REFUNDED`; the existing Booking graph resolves the refund workflow to `REFUNDED`.
- Settlement commands create ProviderPayable rows from completed, reconciled bookings, calculate commission/provider/net amounts using JOD `DECIMAL(12,2)`, create Settlement/SettlementItem rows, approve batches, record directed SettlementPayment rows, prevent duplicate payable inclusion and enforce overpayment/direction rules. Settlement remains separate from customer Payment.

## Database migration

`0005_payments_cash_settlement` is additive and leaves migrations `0001`–`0004` unchanged. It adds:

- `PaymentAttempt` with provider/reference/request-key uniqueness and attempt indexes.
- `PaymentStatusHistory`, `RefundHistory` and `SettlementHistory`, all append-only.
- verified/signature timestamp fields on `PaymentEvent`.
- collector company/team attribution on `CashCollection`.
- refund provider/failure metadata and a Settlement version counter.

The configured PostgreSQL database has all five migrations recorded with matching checksums. Money remains `DECIMAL(12,2)` and currency remains JOD.

## Exact API surface

The shared envelope, DTO validation, UUID parsing, `Idempotency-Key` rules and error mapping from [api.md](api.md) apply.

| Method/path | Authentication and authorization | Main behavior |
|---|---|---|
| `POST /payments` | Customer `payment:own` or admin `payment:manage` | Request `{bookingId}`. Creates an online attempt only from `PRICE_CONFIRMED`/`PAYMENT_PENDING`; returns Payment + attempt/checkout reference. |
| `GET /payments/:id` | Owning customer; finance/admin; scoped cash provider | Returns payment, attempts, status history, transactions, verified events, refunds and cash collection; foreign records are not found. |
| `POST /payments/:id/retry` | Owning customer or `payment:manage` | No body. Retries only `FAILED` online Payment; requires an idempotency key. |
| `POST /webhooks/payments/:provider` | Public provider callback | Signed raw JSON. Requires `x-payment-signature`; invalid signatures are rejected. Verified success/failure is idempotent by provider/event ID. |
| `POST /payments/:id/refunds` | `refund:manage` or `payment:manage` | `{amount,reason}`. Validates reconciled Payment and remaining refundable balance; online mock provider completes server-side, cash remains pending. |
| Existing `POST /bookings/:id/select-cash`, `POST /assignments/:id/collect-cash`, `POST /bookings/:id/reconcile-payment` | Customer selection; scoped `cash:team`/finance collection; finance reconciliation | Preserved Booking-owned cash workflow with attribution/history/audit strengthening. |
| `GET /settlements`, `GET /settlements/:id` | Admin finance or own-company `settlement:company` | Scoped batch and item reads. |
| `POST /settlements` | `settlement:manage` | `{companyId,periodStart,periodEnd}`. Creates a DRAFT batch from eligible completed/reconciled payables. |
| `POST /settlements/:id/approve` | `settlement:manage` | Approves a DRAFT batch. |
| `POST /settlements/:id/payments` | `settlement:manage` | `{amount,direction,reference,paidAt?,reason?}`. Records `TO_PROVIDER` or `TO_PLATFORM` settlement payment and closes/part-pays the batch. |

## Validation evidence

- Prisma schema validation passed; Prisma Client 6.19.3 regenerated.
- Backend build passed.
- Focused unit suite passed **37/37**.
- Focused compiled live PostgreSQL suite passed **1/1** (`payments.test.ts`). It covers concurrent same-key initiation, customer isolation, invalid signature, amount mismatch, webhook replay, verified success, failure/retry, unknown reference, partial/duplicate/over refunds, cash collection attribution and duplicate prevention, reconciliation, settlement creation/duplicate prevention/payment and company-scoped read.
- Exact full backend suite passed **56/56** after applying migrations `0001`–`0005` and the repeatable seed in a fresh PostgreSQL schema, including all Phase 5–8 regression suites.
- PostgreSQL direct inspection passed: configured migration ledger contains `0001_init` through `0005_payments_cash_settlement`, and all Phase 9 tables exist. Redis direct check returned `PONG`.
- `npm.cmd run test:database` remains blocked before its assertions by the pre-existing nested `spawnSync node.exe EPERM` wrapper restriction. This does not invalidate the passing compiled live PostgreSQL suite or exact full suite.

## Provider and remaining limitations

The real gateway remains intentionally abstract. No gateway credentials or provider sandbox were available, so the validated adapter is local/mock and uses HMAC-signed test webhooks. A real provider adapter, production secret management/rotation, external refund SLA/retry policy, notification delivery, production soak, Flutter screens and deployment hardening remain future work.

## Status

Phase 9 is **COMPLETE for the scoped backend acceptance**. Do not start the next phase automatically. The specification’s exact next phase is **Engineering Phase 10 — Settlements**.

