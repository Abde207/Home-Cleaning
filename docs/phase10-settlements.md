# Engineering Phase 10 — Settlements

Updated 2026-09-21. Backend scope complete for the validated local PostgreSQL/Redis acceptance. No Flutter, Notifications, or production deployment work was started.

## Existing Phase 9 boundary retained

Phase 9 already provided `ProviderPayable`, `Settlement`, `SettlementItem`, `SettlementPayment`, settlement reads, create/approve/pay commands, JOD `DECIMAL(12,2)` money, company-scoped reads, idempotency, row locks, settlement history and audit records. Phase 10 keeps `SettlementPayment` as the provider/platform payout record and adds an immutable `SettlementPaymentAllocation` bridge for customer `Payment` records; customer payment transactions are not reused as provider payout records.

## Implemented

- Explicit lifecycle commands: `DRAFT → CALCULATED → READY_FOR_REVIEW → APPROVED → PARTIALLY_PAID/PAID → RECONCILED → CLOSED`, with explicit `CANCELLED` and `REVERSED` commands. The existing create-and-approve caller remains compatible: create calculates to `CALCULATED`, and approve accepts that state directly; the review command is available for the full gated path.
- Locked calculation from completed/refunded bookings with completed company assignments and reconciled/refunded payments. The immutable payable snapshot records gross booking amount, refund total, net customer amount, commission rate/amount, provider amount, online collection, cash collection, and net payable.
- Refund-aware formula:

  `net customer = booking price - successful refunds`

  `Home Clean commission = round(net customer × company commission rate, 2)`

  `provider amount = net customer - commission`

  `net payable = provider amount - cash already collected`

  Cash payables can therefore be negative, requiring `TO_PLATFORM`; positive payables require `TO_PROVIDER`.
- Payment allocation is immutable and unique by `Payment`, preventing a customer payment from being settled twice. Settlement items remain unique by provider payable.
- Reconciliation compares the payable snapshot, immutable allocation, current Payment/refund/cash records, and recorded payout. It stores every run and reports `MATCHED` or `DISCREPANCY`; discrepancies do not silently rewrite financial records.
- Provider/company isolation is enforced by company scope in both list and detail reads. Customers and unscoped provider roles cannot read internal settlements.
- Every write command uses the existing advisory-lock idempotency pattern, settlement row locks, append-only history/audit, and database uniqueness constraints.

## API contract

All write endpoints require an authenticated Home Clean finance/admin actor with `settlement:manage`, a valid `Idempotency-Key`, and the shared response/error envelope. Company managers with `settlement:company` may only `GET` their own company records. Customers have no settlement access.

| Method/path | Request DTO | Response | Validation/errors | Side effects |
|---|---|---|---|---|
| `GET /settlements` | None | Settlement summary list | Company scope; 403 without finance/company permission | None |
| `GET /settlements/:id` | None | Settlement with items, payables, Payment allocations, payout records, reconciliation runs, history | Foreign company is 404 | None |
| `POST /settlements` | `{companyId,periodStart,periodEnd}` | `CALCULATED` Settlement | Valid period/company; completed/refunded eligible records; no eligible records 409; JOD only | Creates payable snapshots/items and immutable Payment allocations; audit/history |
| `POST /settlements/:id/calculate` | None | `CALCULATED` Settlement | `DRAFT` only; no eligible records 409 | Same calculation transaction as create |
| `POST /settlements/:id/submit-review` | None | `READY_FOR_REVIEW` Settlement | `CALCULATED` only | History/audit |
| `POST /settlements/:id/approve` | None | `APPROVED` Settlement | `CALCULATED` or `READY_FOR_REVIEW` only | History/audit |
| `POST /settlements/:id/payments` | `{amount,direction,reference,paidAt?,reason?}` | Settlement payout + status | Exact direction, positive amount, no overpayment, unique reference; 409 otherwise | Immutable `SettlementPayment`; `PARTIALLY_PAID` or `PAID`; history/audit |
| `POST /settlements/:id/reconcile` | None | Reconciliation result | `PAID`/`RECONCILED` only | Append-only reconciliation result; matched `PAID → RECONCILED`; discrepancy remains visible |
| `POST /settlements/:id/close` | None | `CLOSED` Settlement | `RECONCILED` only | History/audit |
| `POST /settlements/:id/cancel` | `{reason?}` | `CANCELLED` Settlement | Pre-payout states only; paid records cannot be cancelled | Explicit cancellation history/audit |
| `POST /settlements/:id/reverse` | `{reason}` | `REVERSED` Settlement | `PAID`, `RECONCILED`, or `CLOSED` only | Does not delete allocations or payouts; records explicit reversal history/audit |

Same-key requests replay the stored response; a reused key with a different request hash returns 409. Concurrent different-key attempts are serialized by company/settlement locks and database uniqueness, so only one allocation succeeds.

## Database changes

Additive migration `0006_settlements_phase10` only. Migrations `0001`–`0005` were not rewritten. It adds lifecycle enum values, payable calculation snapshot columns, immutable `SettlementPaymentAllocation`, append-only `SettlementReconciliation`, financial checks, indexes and foreign keys. Existing financial rows remain intact; legacy nullable calculation snapshot columns are preserved for historical Phase 9 records.

## Validation evidence

- Prisma schema validation and Prisma Client generation passed.
- Backend TypeScript build passed.
- Focused live PostgreSQL acceptance passed **2/2** (`payments.test.ts`, `settlements.test.ts`).
- Unit suite passed **37/37**.
- Full compiled backend regression passed **57/57** in a fresh six-migration schema, including all Phase 5–9 coverage and Phase 10 focused coverage.
- Redis direct PING returned `PONG`; PostgreSQL migration ledger and Phase 10 tables were inspected successfully.
- The standard `npm.cmd run test:database` wrapper remains subject to the known nested Node/Prisma `spawnSync node.exe EPERM` limitation; the unchanged direct/compiled runner passed the complete live suite.

## Remaining limitations

The real external payment gateway remains the Phase 9 local/mock adapter. Production settlement bank rails, notifications, operational monitoring/alerting, correction settlements after a reversal, and production soak/deployment hardening remain future work. Phase 10 is complete for the scoped backend acceptance, not a production deployment claim.
