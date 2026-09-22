# Phase 14 — Admin Dashboard implementation blueprint

Status: **PHASE 14H COMPLETE — FINAL ADMIN HARDENING / HANDOFF**  
Prepared: 2026-09-21  
Source of truth: current repository code, especially `admin/nextjs`, `backend/nestjs/src`, `database/prisma/schema.prisma`, `database/prisma/seed.ts`, and the implemented contract in `docs/api.md`.

The plan below governs implementation; its 14A note records actual work. It does not authorize production integrations, database schema changes, or changes to completed Customer and Provider applications.

> Phase 14A acceptance closeout (2026-09-22): **COMPLETE**. The previously blocked Docker/WSL environment was restored. The documented security/shell gate and its supporting clean-schema, database-integrity, migration, seed, backend, and Admin build validations all passed. At that closeout point, Phase 14B–14H were **NOT STARTED**; Phase 14B was subsequently implemented and closed in the record below. No Phase 14B functionality, Customer or Provider functionality, production code, or migration was changed during this closeout. The BFF refresh coalescer remains process-local; shared coordination is a deployment prerequisite for multi-instance serving. A trusted operator must pre-provision the first Admin identity; public OTP verification intentionally creates only Customer identities. Every future server page must call the Admin page gate before loading/rendering sensitive content because Next may render child pages before a parent layout finishes its check.

> Phase 14B implementation and acceptance closeout (2026-09-22): **COMPLETE**. Implemented only the dashboard aggregate, Admin filtered booking read model, audit list/detail with recursive sensitive-field redaction, identity/grant read permission separation, and the corresponding bilingual read-only Admin screens. No migration was required. Existing Customer and Provider boundaries and explicit mutation commands remain unchanged. Phase 14C, 14D, and 14E were subsequently completed; Phase 14F–14H remain **NOT STARTED**.

### Phase 14A acceptance verification

The documented Phase 14A gate is satisfied by the following passing validations:

| Documented criterion | Passing validation |
|---|---|
| Secure tokens are not client-readable; refresh rotation is serialized | `npm test -- admin-foundation.test.ts` — **1/1 PASS**; Admin foundation tests — **4/4 PASS** |
| Customer/Provider/Dispatcher cannot enter the Admin shell | `npm test -- auth.test.ts core.test.ts` — **2/2 PASS**; backend unit tests — **42/42 PASS** |
| English and Arabic shell tests pass | Admin foundation tests — **4/4 PASS** |
| Clean-schema API and Auth/Core regression gate | `npm test -- auth.test.ts core.test.ts` — **2/2 PASS** |
| Database integrity and repeatable environment setup | `npm run test:database` — **PASS**, **16 integrity assertions**; **7/7 migrations** apply successfully; seed verification — **PASS** |
| Required build/type validation | Backend build — **PASS**; Admin TypeScript — **PASS**; Admin production build — **PASS** |
| Required database dependency | Docker/PostgreSQL — **operational**; the Docker/WSL environment blocker — **resolved** |

Phase 14A is officially **COMPLETE**. Phase 14B, Phase 14C, Phase 14D, Phase 14E, Phase 14F, and Phase 14G are closed in the implementation record below; Phase 14H remains explicitly **NOT STARTED**.

## 1. Scope and governing decisions

Phase 14 should deliver an authenticated, bilingual Home Clean staff web application for operational visibility and the already-supported administrative commands. It should cover dashboard triage, customers, provider companies and teams, catalog/pricing, bookings and dispatch, payments/cash/refunds, settlements, notification delivery visibility, location/operations visibility, identity administration, and audit history.

The implementation must preserve these boundaries:

- The NestJS application remains the sole business and authorization boundary. The Admin UI never writes Prisma directly and never derives authoritative booking, dispatch, payment, refund, or settlement state.
- Existing explicit state-machine commands are reused. There is no generic booking-status, payment-status, or settlement-status editor.
- The Admin app must not consume provider-only projections when an admin-grade projection exists or is required. Conversely, provider-safe projections must not be widened.
- Customer and Provider Flutter code and contracts are not refactored as part of Phase 14.
- Production SMS, payment gateway, object storage, push, maps, and bank rails remain out of scope.
- Phase 14 needs no Prisma schema migration based on the current scope. New permissions are rows in the existing `Permission`/`RolePermission` tables and can be seeded idempotently. A migration is considered only if measured query plans later prove an index is necessary.

## 2. Current architecture

### 2.1 Admin frontend today

`admin/nextjs` is a Next.js 16 App Router package with React 19 and TypeScript 5.9. It contains only:

- `app/layout.tsx`: English root document metadata and an unstyled body.
- `app/page.tsx`: a static “Administrative access is not available yet” shell.
- `package.json`: `dev`, `build`, `start`, and `typecheck`; no test runner, component library, form library, data-fetching library, i18n layer, or authentication implementation.
- No middleware, route groups, API client, route handlers, styles, error/loading/not-found boundaries, or environment validation.

The root npm workspace already includes `admin/nextjs`; `npm run build:admin` and `npm run dev:admin` are available.

### 2.2 Backend support already present

The NestJS backend has a global `/api/v1` prefix, DTO whitelist/unknown-field rejection, sanitized error envelopes, request IDs, CORS configuration, opaque database-backed access/refresh sessions, live role/scope evaluation, and permission metadata. `GET /auth/me` returns the authenticated identity and current scopes/permissions.

Reusable modules and services:

| Module/service | Reusable Admin capability |
|---|---|
| `AuthModule` | OTP sign-in, refresh rotation/replay revocation, logout, session/user/grant checks, `/auth/me` |
| `CoreModule` | customer summaries; identities and grants; services/extras; companies/service areas; teams/members/schedules/capabilities/location/status |
| `BookingModule` | operational booking list/detail and explicit lifecycle/finance commands with locks, histories, idempotency, and audit |
| `PricingModule` | pricing-rule and promotion list/publish/activation |
| `DispatchModule` | automatic offer, reasoned manual dispatch/reassignment of a pending offer, retry, monitoring, candidate policy |
| `PaymentModule` | payment detail/retry/refund, cash truth, booking reconciliation commands, complete settlement lifecycle |
| `NotificationModule` | own-notification reads plus outbox materialization/delivery workers and delivery-attempt persistence |
| `LocationModule` | address validation/geocoding abstraction and persisted team locations used by dispatch |
| `ProviderAssignmentsModule` | provider-only safe work projections; useful implementation precedent, but not an Admin API |

Reusable explicit projections include `serviceSelect`, `extraSelect`, `companySelect`, `areaSelect`, `teamSelect`, `providerTeamDetailSelect`, `bookingListSelect`, and `bookingSelect`. The booking detail projection already contains immutable address/property/service/price snapshots, status history, assignments/events/proofs, payments/transactions/refunds, and cash collection. Dispatch monitoring returns status counts and the latest 100 attempts. The legacy settlement detail is intentionally admin-grade and contains allocations, payable calculation data, reconciliation, and history.

## 3. Roles, permissions, and authorization boundaries

### 3.1 Existing persisted roles and grants

| Role | Existing permissions |
|---|---|
| `CUSTOMER` | `profile:own`, `address:own`, `property:own`, `booking:own`, `payment:own`, `rating:own`, `support:own`, `notification:own` |
| `COMPANY_MANAGER` | `company:own`, `team:company`, `assignment:company`, `settlement:company`, `notification:own` |
| `TEAM_LEADER_CLEANER` | `assignment:team`, `job:team`, `cash:team`, `notification:own` |
| `DISPATCHER` | `booking:operations`, `dispatch:manage`, `company:read`, `team:read`, `notification:own` |
| `HOME_CLEAN_ADMIN` | `booking:operations`, `dispatch:manage`, `company:manage`, `team:manage`, `customer:read`, `service:manage`, `pricing:manage`, `payment:manage`, `refund:manage`, `settlement:manage`, `support:manage`, `promotion:manage`, `audit:read`, `identity:manage`, `notification:own` |

`rating:own`, `support:own`, and `support:manage` are seeded aspirations only: the schema has `Rating` and `SupportTicket`, but no implemented controller/service API exists for them.

### 3.2 Required Phase 14 permission refinements

Add the following permission rows and grant them to `HOME_CLEAN_ADMIN` in the idempotent seed. They do not require a schema migration:

- `admin:dashboard:read` — aggregate dashboard and operational location reads.
- `identity:read` — identity list/detail/grant visibility without mutation.
- `payment:read` — payment list/detail visibility without payment mutation.
- `refund:read` — refund visibility without refund creation/completion.
- `cash:read` — cash worklist and reconciliation visibility.
- `settlement:read` — settlement list/detail visibility without lifecycle mutation.
- `notification:operations:read` — cross-user delivery health and attempt visibility.

Keep existing mutation permissions (`identity:manage`, `payment:manage`, `refund:manage`, `settlement:manage`, `dispatch:manage`, and domain `*:manage`) separate. During Phase 14, the sole `HOME_CLEAN_ADMIN` role may hold both read and write grants, but controllers and services must check the narrow permission so a future read-only finance or auditor role does not require endpoint rewrites.

Do not add a new Prisma `RoleName` in Phase 14. Creating finance-viewer, finance-approver, or auditor roles would change the enum and require a migration. Maker/checker enforcement is therefore deferred; the initial dashboard can separate capabilities, confirmations, reasons, idempotency, and audit, but cannot claim dual-control approval.

### 3.3 Authorization rules

- All `/admin/**` routes require an active session, an unscoped platform grant (`companyId = null`, `teamId = null`), and the route’s permission. For the current role set this means `HOME_CLEAN_ADMIN`; permission checks remain the capability mechanism.
- Existing provider company/team routes retain their current company/team scope behavior. Foreign scoped resources continue to return 404 where that is the established anti-enumeration contract.
- The UI may hide navigation/actions based on `/auth/me`, but backend authorization is mandatory on every request.
- Sensitive detail is fetched only on an explicit detail page. Tables use purpose-built projections and must not return provider webhook hashes/payloads, OTPs, session hashes, device tokens, checkout URLs, or unrestricted notification payloads.
- Financial list/detail reads use the new read permissions. Mutations continue to require their current manage permission and exact server-side state checks.
- Identity status changes and role revocation continue to revoke sessions. The UI must warn about this effect.

## 4. Admin information architecture

Primary navigation, shown only when the current actor has at least one permission for the section:

1. **Dashboard** — booking/dispatch exceptions, finance work queues, provider health, notification failures, and shortcuts.
2. **Operations**
   - Bookings
   - Dispatch
   - Locations
3. **Customers** — customer lookup, profile/status, recent bookings, link to identity controls.
4. **Providers**
   - Companies
   - Teams
5. **Catalog**
   - Services and extras
   - Pricing rules
   - Promotions
6. **Finance**
   - Payments and refunds
   - Cash reconciliation
   - Settlements
7. **Communications**
   - Notification delivery health
8. **Governance**
   - Users and role grants
   - Audit log

“Settings” must not be a generic editable configuration page. Runtime environment values, dispatch weights/timeouts, payment provider selection, notification provider settings, CORS, and credentials are deployment configuration and remain read-only/out of UI. The only configuration pages supported by actual APIs are catalog, service areas, team capability/availability, pricing rules, promotions, user status, and role grants.

Support tickets and ratings are not included in Phase 14 because models alone do not constitute an implemented backend. They require a separately scoped product phase.

## 5. Backend capability map

Classification is against current code, not design-document intent.

| Admin capability | Classification | Implemented source / required delta |
|---|---|---|
| OTP login, refresh, logout, current identity | **EXISTS — reusable as-is** | `/auth/request-otp`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Admin dashboard KPIs/work queues | **IMPLEMENTED IN PHASE 14B** | `GET /admin/dashboard` keeps counts and operational attention server-derived |
| Customer list/detail | **IMPLEMENTED IN PHASE 14C** | Dedicated projections expose bounded filters, `userId`, counts, recent bookings, and no editable address/property records |
| Customer status management | **IMPLEMENTED IN PHASE 14C** | Existing `/admin/users/:id/status` reused; audited and revokes sessions when non-active |
| Customer saved addresses/properties editor | **NOT REQUIRED FOR PHASE 14** | Only own-resource APIs exist; exposing private saved data or editing it is not needed for investigation |
| User list, provision/grant, grant list/revoke | **EXISTS — reusable as-is** | `/admin/users`, `/admin/users/:id/roles`, `POST /admin/users`, `DELETE .../roles/:grantId` |
| Read-only user browsing separate from manage | **IMPLEMENTED IN PHASE 14B/14C** | GETs accept `identity:read` or `identity:manage`; filters are bounded; writes remain `identity:manage` |
| Company list/create/update and service-area CRUD | **EXISTS — reusable as-is** | `/admin/companies`; nested service-area endpoints |
| Company detail with related operational counts | **IMPLEMENTED IN PHASE 14D** | Admin-safe detail projection includes bounded counts and service areas |
| Team list/detail/members/schedule/capabilities/location/status | **EXISTS — reusable as-is** | `/provider/teams/**` already admits Admin `team:manage`; preserve provider response safety |
| Server-side team/company/status search filters | **IMPLEMENTED IN PHASE 14D** | Existing list endpoints accept bounded server-side filters without widening provider projections |
| Services/extras administration | **EXISTS — reusable as-is** | `/admin/services/**` |
| Pricing rules/promotions | **EXISTS — reusable as-is** | `/admin/pricing/rules/**`, `/admin/promotions/**` |
| Booking detail/investigation timeline | **IMPLEMENTED IN PHASE 14E** | Admin-only `/admin/bookings/:id` safe investigation projection; customer/provider `/bookings/:id` remains unchanged |
| Admin booking search/filter/work queue | **IMPLEMENTED IN PHASE 14B** | Dedicated filtered `/admin/bookings` projection supports operational triage |
| Cancel/retry/no-team and operational commands | **EXISTS — reusable as-is** | Existing explicit Booking commands; show only state-appropriate actions |
| Dispatch counts/recent attempts | **EXISTS — reusable as-is** | `/dispatch/monitoring` |
| Automatic offer/manual dispatch/pending-offer reassignment | **IMPLEMENTED IN PHASE 14E** | Existing `/dispatch/bookings/:id/offer` and `/manual` commands are exposed through the Admin BFF/UI; reason, eligibility, lock, idempotency and audit behavior remain backend-owned |
| Reassign accepted/started/terminal job | **NOT REQUIRED FOR PHASE 14** | Backend explicitly returns `DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED`; requires a future recovery state-machine design |
| Payment detail, retry, refund command | **EXISTS — reusable as-is with read permission refinement** | `/payments/:id`, `/payments/:id/retry`, `/payments/:id/refunds` |
| Payment/refund list and filtering | **IMPLEMENTED IN PHASE 14F** | Admin-safe payment/refund projections with bounded status, booking, customer, company, date and cash filters |
| Cash reconciliation worklist | **IMPLEMENTED IN PHASE 14F** | Server-derived expected/collected/reconciled/exception projection; reconciliation reuses booking commands |
| Collect cash on behalf of a cleaner | **NOT REQUIRED FOR PHASE 14** | Existing assignment command permits operations technically, but Admin UI should not attest physical receipt; add only after an exception policy |
| Booking payment reconciliation/completion | **EXISTS — reusable as-is** | Explicit idempotent booking commands with state/proof checks |
| Settlement list/detail/lifecycle | **IMPLEMENTED IN PHASE 14F** | Admin-safe filtered list/detail accepts `settlement:read` or `settlement:manage`; lifecycle commands remain explicit |
| Notification inbox for the signed-in admin | **EXISTS — reusable as-is** | `/notifications`, `PATCH /notifications/:id/read` |
| Cross-user delivery/attempt monitoring | **IMPLEMENTED IN PHASE 14G** | `AdminObservabilityModule`: persisted delivery list/detail and attempt projections |
| Manual notification composition/broadcast/retry | **NOT REQUIRED FOR PHASE 14** | Avoids creating a messaging product or bypassing the authoritative outbox; production push is not integrated |
| Company service areas and individual team locations | **EXISTS — reusable as-is** | Company area endpoints and team detail/location endpoints |
| Operations-wide location freshness view | **IMPLEMENTED IN PHASE 14G** | `GET /admin/operations/locations` over stored Team coordinates/timestamps and existing service-area projection |
| Audit log search/detail | **IMPLEMENTED IN PHASE 14B** | Bounded list/detail reads with recursive sensitive-field redaction |
| Arbitrary role/permission editing | **NOT REQUIRED FOR PHASE 14** | Roles and grants are seeded; user grant/revoke is sufficient for this phase |
| Runtime/deployment setting mutation | **NOT REQUIRED FOR PHASE 14** | Environment-controlled and intentionally outside application data |
| Ratings/support | **NOT REQUIRED FOR PHASE 14** | Schema only; no implemented business/API boundary |

## 6. Required API deltas

All responses use the existing `{data,meta}` envelope and sanitized common errors. GETs are read-only and require no idempotency key. UUIDs are v4. Dates are strict ISO-8601 instants. List limits are `1..100` (default 50), offsets `0..1,000,000`, with deterministic secondary `id` ordering. Unknown query fields are rejected.

### 6.1 `GET /admin/dashboard` — IMPLEMENTED IN PHASE 14B

- **Authentication:** bearer session; unscoped `HOME_CLEAN_ADMIN` grant.
- **Permission:** `admin:dashboard:read`.
- **Request DTO:** `AdminDashboardQueryDto { from?: ISO8601, to?: ISO8601 }`; default is the current UTC day for flow metrics plus current-state totals; maximum range 31 days; `from < to`.
- **Response DTO:** `{generatedAt, range, bookingsByStatus[{status,count}], assignmentsByStatus[{status,count}], attention{noTeamAvailable,rejected,teamNoShow,paymentReconciliation,refundPending}, finance{paymentPending,paymentFailed,cashExpected,cashCollectedUnreconciled,settlementsReadyForReview,settlementDiscrepancies}, providers{companiesByStatus,teamsByStatus,staleTeamLocations}, notifications{pending,failed}, recentDispatchAttempts[]}`. Money totals, if included later, are decimal strings grouped by currency; the first version should prefer counts to avoid ambiguous mixed-period accounting.
- **Validation/errors:** 400 invalid range; 401; 403; sanitized 500/503.
- **Idempotency:** not applicable.
- **Side effects:** none; use parallel aggregate queries, no persisted snapshot.
- **Audit:** no audit row for ordinary reads; access logging/request ID only. Do not place sensitive details in logs.

### 6.2 `GET /admin/companies/:id` — IMPLEMENTED IN PHASE 14D

- **Authentication/permission:** unscoped Admin; `company:manage` (future `company:read` may also read).
- **Request DTO:** UUID path only.
- **Response DTO:** `AdminCompanyDetail {id,internalCode,name,status,commissionRate,createdAt,updatedAt,counts{teams,activeTeams,activeManagers,openAssignments,unsettledPayables},serviceAreas[]}`. Commission is Admin-only; do not reuse this projection for Provider APIs.
- **Validation/errors:** 400 UUID; 404 missing; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** access log only.

### 6.3 `GET /admin/bookings` — IMPLEMENTED IN PHASE 14B

- **Authentication/permission:** unscoped Admin; `booking:operations`.
- **Request DTO:** `AdminBookingListQueryDto {limit,offset,status?,paymentMethod?,companyId?,teamId?,customerId?,serviceId?,scheduledFrom?,scheduledTo?,createdFrom?,createdTo?,bookingNumber?}`. Date pairs must be ordered; `bookingNumber` is trimmed, 1..40, exact or prefix search; team must belong to company when both supplied.
- **Response DTO:** `AdminBookingSummary[]` with `{id,bookingNumber,status,paymentMethod,price,currency,scheduledAt,estimatedEndAt,createdAt,customer{id,name,phone,status},service{id,name,nameAr},currentAssignment?:{id,status,company{id,name},team{id,name},expiresAt},payment?:{id,method,status}}`.
- **Validation/errors:** 400 invalid enum/range/filter combination; 404 is not used for an empty list; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** access log only. Phone appears only because this is the explicit Admin operations projection.

### 6.4 `GET /admin/payments` — IMPLEMENTED IN PHASE 14F

- **Authentication/permission:** unscoped Admin; `payment:read` or `payment:manage`.
- **Request DTO:** `AdminPaymentListQueryDto {limit,offset,status?,method?,bookingId?,bookingNumber?,customerId?,companyId?,createdFrom?,createdTo?,hasRefund?,cashState?}` where `cashState=EXPECTED|COLLECTED|RECONCILED`; incompatible filters return 400.
- **Response DTO:** `AdminPaymentSummary[] {id,booking{id,bookingNumber,status,scheduledAt},customer{id,name,phone},method,status,amount,currency,provider,transactionReference,refundTotal,cashCollection?:{id,amount,collectedAt,reconciledAt,collectorCompanyId,collectorTeamId},createdAt,updatedAt}`. Do not include checkout URLs, raw provider payloads, or payload hashes.
- **Validation/errors:** 400 invalid query; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** access log only.

`GET /admin/payments/:id` uses the same permission and returns the safe investigation projection: booking/customer/service references, attempts without checkout URLs or request keys, status history, safe event summaries without payload hashes, transactions, refunds/history, cash collection, and settlement allocations. It is read-only and has no side effects.

`GET /admin/refunds` accepts `AdminRefundQueryDto {limit,offset,status?,paymentId?,bookingId?,customerId?,companyId?,createdFrom?,createdTo?}` and returns safe refund summaries with booking/customer references. It accepts `refund:read`, `refund:manage`, or `payment:manage`; it is read-only.

### 6.5 `GET /admin/cash-reconciliation` — IMPLEMENTED IN PHASE 14F

- **Authentication/permission:** unscoped Admin; `cash:read` or `payment:manage`.
- **Request DTO:** `AdminCashQueryDto {limit,offset,state?,companyId?,teamId?,scheduledFrom?,scheduledTo?}`, `state=EXPECTED|COLLECTED|RECONCILED|EXCEPTION`; team/company relationship validated when both are supplied.
- **Response DTO:** `AdminCashItem[] {paymentId,booking{id,bookingNumber,status,scheduledAt},expectedAmount,currency,state,assignment{id,company{id,name},team{id,name}},collection?:{id,amount,collectedBy{id,name},collectedAt,reconciledAt},exceptionCodes[]}`. `state` is server-derived; no client arithmetic.
- **Validation/errors:** 400 invalid filters; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** access log only. Reconciliation mutation continues through `POST /bookings/:id/reconcile-payment` with `payment:manage` and a key.

### 6.6 Admin settlement projections — IMPLEMENTED IN PHASE 14F

- `GET /admin/settlements` accepts `AdminSettlementQueryDto {limit,offset,status?,companyId?,periodFrom?,periodTo?,reconciliationStatus?}` and returns settlement/company metadata, authoritative totals, paid totals, payout direction, item/allocation counts, and the latest reconciliation summary.
- `GET /admin/settlements/:id` returns the safe settlement investigation projection: payable calculation fields, booking/customer/service references, immutable allocations, payouts, reconciliation runs/details, and lifecycle history.
- Both endpoints require unscoped Admin `settlement:read` or `settlement:manage`, are read-only, and do not expose provider credentials or allow client-derived financial state.
- Existing explicit settlement commands remain unchanged and require `settlement:manage`, a valid idempotency key, row locking, lifecycle validation, transactional histories/audit, and authoritative refresh after UI mutation.

### 6.7 `GET /admin/notification-deliveries` — IMPLEMENTED IN PHASE 14G

- **Authentication/permission:** unscoped Admin; `notification:operations:read`.
- **Request DTO:** `AdminNotificationDeliveryQueryDto {limit,offset,status?,type?,userId?,referenceType?,referenceId?,createdFrom?,createdTo?}`.
- **Response DTO:** `AdminNotificationDeliverySummary[] {id,notificationId,status,channel,attempts,lastError,nextAttemptAt,sentAt,createdAt,notification{type,category,referenceType,referenceId,userId,createdAt}}`. Exclude device-token values and unrestricted payload content.
- **Validation/errors:** 400 invalid enum/range/UUID; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** access log only.

### 6.8 `GET /admin/notification-deliveries/:id` — IMPLEMENTED IN PHASE 14G

- **Authentication/permission:** same as delivery list.
- **Request DTO:** UUID path.
- **Response DTO:** list DTO plus `attemptsHistory[{id,attemptNumber,status,providerReference,error,createdAt}]` and a redacted notification payload allowlist (`title`, `body`, and business reference identifiers only).
- **Validation/errors:** 400 UUID; 404 missing; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** access log only.

### 6.9 `GET /admin/operations/locations` — IMPLEMENTED IN PHASE 14G

- **Authentication/permission:** unscoped Admin; `admin:dashboard:read` and `team:manage` (or a future `operations:read`).
- **Request DTO:** `AdminLocationsQueryDto {companyId?,teamId?,teamStatus?,freshness?,locationAvailability?,limit?,offset?}`, `freshness=FRESH|STALE|NEVER_REPORTED`, `locationAvailability=AVAILABLE|MISSING`. Freshness uses the same server configuration as dispatch.
- **Response DTO:** `{generatedAt,locationMaxAgeMinutes,teams: AdminTeamLocation[],serviceAreas: AdminServiceArea[]}` where a team row has `{id,name,status,active,company{id,name,status},latitude,longitude,locationAt,freshness}` and areas use the existing area projection.
- **Validation/errors:** 400 invalid query; 401/403/common errors.
- **Idempotency/side effects:** none/read-only. This is stored-location visibility, not real-time tracking.
- **Audit:** access log only.

### 6.10 `GET /admin/audit-logs` — IMPLEMENTED IN PHASE 14B

- **Authentication/permission:** unscoped Admin; `audit:read`.
- **Request DTO:** `AuditLogQueryDto {limit,offset,actorUserId?,action?,resourceType?,resourceId?,requestId?,createdFrom?,createdTo?}`; strings trimmed and bounded to schema lengths; maximum range 90 days unless an exact resource or actor is supplied.
- **Response DTO:** `AuditLogSummary[] {id,actor?:{id,name,phone,status},action,resourceType,resourceId,reason,requestId,createdAt}`. List omits `before`/`after` payloads.
- **Validation/errors:** 400 invalid UUID/range/length; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** do not recursively create an `AuditLog` row for reading audit logs; security access log only.

### 6.10 `GET /admin/audit-logs/:id` — IMPLEMENTED IN PHASE 14B

- **Authentication/permission:** same as audit list.
- **Request DTO:** UUID path.
- **Response DTO:** summary plus `{before,after}` using stored JSON. The service applies a recursive redaction denylist for tokens, OTP/code, secrets, credentials, signatures, raw payloads, and device tokens before serialization.
- **Validation/errors:** 400 UUID; 404 missing; 401/403/common errors.
- **Idempotency/side effects:** none/read-only.
- **Audit:** security access log only.

### 6.11 Existing endpoints that need contract-safe extension

These are not new endpoint paths, but they are Phase 14 backend work:

- `GET /admin/customers`: accept `status?`, `locale?`, and bounded `query?` (phone exact/prefix or name contains); return `{id,userId,name,phone,locale,status,createdAt,bookingCount,lastBookingAt}`. Permission remains `customer:read`.
- `GET /admin/customers/:id`: return the same identity fields plus `{counts{addresses,properties,bookings},recentBookings: BookingSummary[0..10]}`. Do not return editable address/property records. Permission `customer:read`.
- `GET /admin/users`: GET accepts `identity:read` or `identity:manage` and supports bounded `status?`, `role?`, and `query?` filters. Writes remain `identity:manage`.
- `GET /admin/companies` and `GET /provider/teams`: add server-side filters needed by Admin tables while preserving current defaults and provider scope. Company filters: `status?`, `query?`. Team filters: `companyId?`, `status?`, `active?`, `query?`.
- `GET /payments/:id`: permit `payment:read`, `refund:read`, or existing manage permissions for platform Admin; keep scoped customer/provider checks unchanged. Consider splitting its response into an Admin detail projection so provider/customer callers never receive added fields.
- `GET /settlements` and `GET /settlements/:id`: allow `settlement:read` or `settlement:manage` for unscoped Admin. Add pagination/status/company/date filters to the list. Lifecycle writes continue to require only `settlement:manage`. Provider `/provider/settlements/**` remains unchanged.
- Existing financial write endpoints retain required idempotency keys. Every Admin action dialog generates one stable key, keeps it through timeout/retry, and discards it only after an authoritative success or a deliberate abandoned action.

## 7. Admin frontend architecture

### 7.1 Proposed Next.js structure

```text
admin/nextjs/
  app/
    [locale]/
      (auth)/login/page.tsx
      (admin)/layout.tsx
      (admin)/page.tsx
      (admin)/customers/...
      (admin)/providers/companies/...
      (admin)/providers/teams/...
      (admin)/catalog/...
      (admin)/operations/bookings/...
      (admin)/operations/dispatch/...
      (admin)/operations/locations/...
      (admin)/finance/payments/...
      (admin)/finance/cash/...
      (admin)/finance/settlements/...
      (admin)/communications/notifications/...
      (admin)/governance/users/...
      (admin)/governance/audit/...
      loading.tsx
      error.tsx
      not-found.tsx
    api/session/{otp,verify,refresh,logout}/route.ts
    layout.tsx
  components/{shell,data-table,filters,detail,forms,feedback}/
  lib/{api,auth,permissions,i18n,format,idempotency,validation}/
  messages/{en,ar}.json
  tests/
```

### 7.2 Session and API client

- Use a same-origin Next.js backend-for-frontend session boundary. Route handlers exchange OTP/refresh calls with NestJS and store opaque access and refresh tokens only in `HttpOnly`, `Secure` (outside local HTTP), `SameSite=Lax`, path-scoped cookies. Do not put tokens in `localStorage` or expose the refresh token to client JavaScript.
- Server components/loaders call a typed server-only API client. Browser mutations call same-origin Next route handlers/server actions, which attach the bearer token. The BFF must forward/generate `x-request-id`, preserve the backend error code/message envelope, and never log tokens.
- Serialize refresh per browser session to avoid concurrent use of a rotating refresh token. On refresh failure, clear both cookies and return to login.
- After verification and on protected-layout entry, call `/auth/me`; require an active unscoped `HOME_CLEAN_ADMIN` scope. A newly OTP-created `CUSTOMER` must receive a clear forbidden screen and be logged out of the Admin app.
- Environment: validate a server-only `BACKEND_API_URL`; never expose secrets through `NEXT_PUBLIC_*`.

### 7.3 UI behavior

- Permission-aware navigation derives from `/auth/me`, with a backend 403 still treated as authoritative. Deep links render a forbidden state rather than a misleading not-found page.
- Data tables use URL-backed filters, deterministic offset pagination, sortable columns only when the API explicitly supports ordering, sticky headers, keyboard navigation, accessible labels, and locale-aware date/money formatting. Never fetch all records for client-side filtering.
- Detail pages have summary header, status chips, related-resource links, immutable history/timeline, and an action rail. Raw JSON is not the primary interface; structured snapshots may have a guarded JSON disclosure for audit users.
- Destructive or financially meaningful commands use confirmation dialogs showing target, current state, expected result, required reason where supported, and a generated stable idempotency key. Disable double submission, but retain the same key on an ambiguous timeout and refetch detail after every result.
- Loading uses route skeletons; filter refresh preserves the existing table. Errors distinguish unauthenticated, forbidden, not found, conflict/stale state, validation, dependency unavailable, and unexpected request-ID-bearing failures. Empty state distinguishes “no data” from “no filter matches.”
- Dates are displayed in `Asia/Amman` by default with an explicit timezone label; API input/output remains ISO UTC/offset instants. Money is formatted from decimal strings without binary floating-point arithmetic.

### 7.4 English/Arabic

Arabic/English support is required for architectural consistency: users persist `locale=ar|en`, catalog/service snapshots contain `nameAr`, and both mobile apps already support bilingual UI. Use locale-prefixed routes, translation dictionaries, `dir=rtl` for Arabic and `dir=ltr` for English, logical CSS properties, Arabic-aware table/action layout, and locale-aware formatting. Domain codes/statuses remain stable untranslated API values and are mapped to translated labels in the UI. Missing translations fail tests/build rather than silently leaking keys.

## 8. Operational workflows

### Booking investigation

1. Open filtered Admin booking list by booking number, status, customer, company/team, or date.
2. Load existing `/bookings/:id` detail and link to the customer, assignment/team/company, payment, and settlement when present.
3. Render immutable snapshots and ordered booking/assignment/payment/refund histories; do not reconstruct history from current catalog/profile records.
4. Offer only valid explicit actions based on server state and permission. After any command, refetch the booking detail.

### Manual dispatch and reassignment

1. Start from a booking in an assignable state and inspect dispatch monitoring plus candidate company/team configuration.
2. Call automatic offer or manual endpoint. Manual selection requires company, team, nonblank reason, and an explicit confirmation when overriding availability/area.
3. Reassignment is supported only while replacing a pending offer through the existing manual policy. Accepted, started, terminal, and terminal no-team recovery stays unavailable and is clearly explained.
4. Preserve the same idempotency key across an ambiguous retry and display returned eligibility decisions only to authorized operations staff.

### Customer management

Search by phone/name, view safe profile/counts/recent bookings, open booking investigations, and use the existing User status command via `userId`. Do not edit customer addresses/properties or mutate historical booking snapshots. Suspending/deactivating shows the session-revocation warning.

### Provider company and team management

Use existing company/team/service-area/schedule/capability/status/location commands. Company commission is Admin-only. Identity provisioning attaches managers/cleaners to scopes; role revocation deactivates matching cleaner membership and revokes sessions. Company/team deactivation effects must be stated before confirmation.

### Cash reconciliation

Use the server-derived cash worklist. “Expected” is not “collected”; “collected” is not “reconciled.” Admin can inspect collector/company/team and exact expected amount. Reconciliation uses the existing booking command only after the backend confirms a collection and required completion state. No Admin “mark cash collected” button in Phase 14.

### Settlement review

Create/calculate, submit review, inspect immutable payable/allocation/reconciliation detail, approve, record payout, reconcile, close/cancel/reverse using existing commands. The UI never computes commission or payable totals. Each mutation displays state preconditions, uses a stable idempotency key, and refetches authoritative detail.

### Notifications

The admin’s own notification inbox uses existing endpoints. The operations page is read-only delivery health and attempts. It does not compose messages, replay outbox events, or promise real push delivery while the mock provider is in use.

### Audit/history

Search audit by actor/action/resource/request/time, open redacted before/after detail, and cross-link resource IDs. Business histories remain on booking/payment/settlement detail; AuditLog is governance evidence, not a replacement for domain history.

## 9. Financial safety

- Use separate read permissions (`payment:read`, `refund:read`, `cash:read`, `settlement:read`) and existing mutation permissions. UI visibility is not authorization.
- Payment list projections expose operational references only; verified event hashes, raw webhook bodies, checkout URLs, and secrets are excluded. Existing detail should be reviewed before reuse and split by caller if widening it.
- Never infer online success from the Admin UI. Verified webhook/provider logic remains authoritative.
- Cash screens display server expected amount and collection state. No client totals and no Admin physical-receipt attestation in this phase.
- Refund creation requires amount and reason and uses the existing remaining-balance/state validation. No arbitrary refund status mutation is added.
- Settlement totals, commission, allocations, refunds, payout direction, and reconciliation difference come only from backend snapshots/calculation.
- Every financial mutation keeps the current locking and actor/operation/key idempotency semantics. UI-generated keys are 1..128 allowed characters and stable through timeout retry.
- Every mutation remains transactionally audited with actor, resource, before/after where appropriate, reason, and request ID. Read endpoints use security access logs, not recursive AuditLog writes.
- Current role design cannot enforce maker/checker separation because one `HOME_CLEAN_ADMIN` role holds all finance grants. Do not claim dual control; defer new role enums/approval records to a later governance phase.

## 10. Database requirements

No Phase 14 migration is required by this blueprint. Reuse:

- Identity/security: `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `Session`, `IdempotencyKey`, `AuditLog`.
- Customer/provider/catalog: `Customer`, `Company`, `Team`, `TeamMember`, `TeamAvailability`, `CompanyServiceArea`, `Service`, `ServiceExtra`, `TeamServiceCapability`, `Address`, `Property`.
- Operations: `Booking`, snapshots/extras/history, `Assignment`, `AssignmentEvent`, `DispatchAttempt`, `CompletionProof`.
- Finance: `Payment`, attempts/events/transactions/history, `CashCollection`, `Refund`/history, `ProviderPayable`, `Settlement` and its item/payment/allocation/reconciliation/history tables.
- Communications/location: `OutboxEvent`, `Notification`, `NotificationDelivery`, `NotificationDeliveryAttempt`, `DeviceToken`, and Team/service-area location columns.

Permission additions are idempotent seed-data changes. Do not create a migration during reconnaissance. Before any implementation-time index migration, capture `EXPLAIN (ANALYZE, BUFFERS)` against representative data and document why existing indexes are insufficient. Possible future search/index work is not a reason to migrate now.

## 11. Testing strategy

### Backend

- Unit tests for each query DTO, platform-scope policy, projection redaction, filter construction, dashboard aggregation, location freshness, finance-state derivation, and audit recursive redaction.
- Authorization matrix tests for unauthenticated, customer, manager, cleaner, dispatcher, Admin read permission, Admin manage permission, platform-vs-scoped grant, and revoked/inactive sessions.
- Clean-schema integration tests for every new/extended endpoint: pagination and deterministic ordering, filter combinations, empty results, foreign IDs, redacted fields, permission separation, and no side effects on GET.
- Financial concurrency/idempotency regression for refunds, reconciliation, and settlement commands invoked through Admin flows.
- Existing auth/core/booking/pricing/dispatch/payment/settlement/Phase 11/provider suites remain mandatory.

### Admin frontend

- Add Vitest + React Testing Library + user-event for permission navigation, bilingual/RTL rendering, table filters/pagination, detail timelines, error/empty/loading states, confirmation dialogs, idempotency-key retention, and money/date formatting.
- Add API-client contract tests with mocked Nest envelopes for refresh serialization, 401 logout, 403, 404, 409, validation, 503, and request-ID display.
- Add Playwright only for high-value browser journeys against a local clean test backend: Admin OTP login, booking investigation/manual dispatch, customer suspension warning, provider team configuration, cash reconciliation, settlement review, audit lookup, and forbidden non-admin login.
- Accessibility candidates: keyboard-only navigation/dialogs/tables, focus restoration, labels, status not conveyed only by color, and LTR/RTL snapshots.

## 12. Implementation sequence

### 14A — Security foundation and application shell

- Add seed permission refinements and platform-permission helper/tests.
- Implement the Next BFF session flow, `/auth/me` gate, locale routing, RTL/LTR shell, permission navigation, design tokens, API/error primitives, and frontend test tooling.
- No business mutation UI yet.

**Gate:** secure tokens are not client-readable; refresh rotation is serialized; Customer/Provider/Dispatcher cannot enter the Admin shell; English and Arabic shell tests pass.

### 14B — Read models, dashboard, and governance

- Add dashboard, Admin booking list, audit list/detail, and read-permission refinements.
- Build dashboard, bookings table/read-only detail, users/grants read UI, and audit pages.
- This establishes reusable table/filter/detail/timeline components before mutation-heavy pages.

**Gate:** all aggregate/list/detail endpoints are projection-safe; audit payload redaction and permission matrix pass.

**Phase 14B implementation record (2026-09-22):** The backend now exposes `GET /admin/dashboard`, filtered `GET /admin/bookings`, `GET /admin/audit-logs`, and `GET /admin/audit-logs/:id` through a dedicated Admin read-model module. `GET /admin/users` and `GET /admin/users/:id/roles` accept `identity:read` or `identity:manage` while all identity mutations remain `identity:manage`. The Admin app now renders the dashboard, booking table/detail, users/grants, and audit list/detail screens with loading/error/empty/forbidden handling, URL-backed filters, safe links, and English/Arabic direction support. Existing `GET /bookings/:id` is reused for authoritative booking investigation detail. No Phase 14B mutation UI, database migration, Customer change, Provider change, or production integration was added.

**Phase 14B validation record:** focused real-PostgreSQL clean-schema acceptance `admin-read-models.test.ts` — **1/1 PASS**; backend unit suite — **42/42 PASS**; relevant Auth/Booking/Dispatch/Payments/Settlements regressions — **5/5 PASS**; Admin tests — **7/7 PASS**; backend build — **PASS**; Admin TypeScript/typecheck — **PASS**; Admin production build — **PASS**; Prisma schema validation through the installed local engine — **PASS**. The standard root integration wrapper reached PostgreSQL but remained blocked before test discovery by Windows Prisma schema-engine `spawn EPERM`; the established direct runner applied the unchanged migrations and ran the focused and regression suites successfully against fresh schemas. Phase 14B is **COMPLETE**; the later phase records below supersede the historical “not started” note.

### 14C — Customers and identity commands

- Extend customer/user list/detail projections and filters.
- Build customer lookup/detail, status mutation, user provisioning/grant listing/revocation with warnings and authoritative refresh.

**Gate:** role-scope validation, session revocation, customer privacy, and no address/property editing regressions.

**Phase 14C implementation record (2026-09-22):** Implemented only the Customers/Identity slice. The backend now exposes dedicated Admin-safe customer list/detail projections with bounded status/locale/search filters, identity metadata, booking counts, last-booking timestamp, and up to ten safe recent booking summaries. Customer detail intentionally excludes address/property records. `GET /admin/users` now supports bounded status/role/search filters while preserving `identity:read` versus `identity:manage` separation. Existing explicit identity commands were reused: `POST /admin/users`, `PUT /admin/users/:id/status`, and `DELETE /admin/users/:id/roles/:grantId`; the Admin UI adds provisioning, status, and grant-revocation confirmations and reloads authoritative projections after success. No Customer or Provider functionality was changed, no arbitrary PATCH state changes were added, and no production integration was introduced.

**Phase 14C validation record:** fresh PostgreSQL clean-schema `admin-customers.test.ts` — **1/1 PASS**; backend unit suite — **42/42 PASS**; focused Auth/Core regression — **2/2 PASS**; Admin frontend tests — **7/7 PASS**; backend build — **PASS**; Admin TypeScript/typecheck — **PASS**; Admin production build — **PASS**; seven unchanged migrations applied successfully to the fresh test schema and seed verification passed; no migration was created. The direct clean-schema runner was used because the standard Windows Prisma schema-engine wrapper remains subject to `spawn EPERM` before test discovery. Phase 14C is **COMPLETE**; Phase 14D and Phase 14E were implemented and closed below, while Phase 14F–14H remain explicitly **NOT STARTED**.

### 14D — Providers, teams, catalog, and supported configuration

- Add company detail and company/team filters.
- Build company/service-area, team/member/schedule/capability/status, service/extra, pricing-rule, and promotion pages on existing commands.

**Gate:** manager/cleaner/provider contracts remain unchanged; all privileged writes remain audited and scoped.

**Phase 14D implementation record (2026-09-22):** Added the missing Admin company detail projection with commission, lifecycle timestamps, service areas, and server-derived counts for teams, active teams, active company managers, open assignments, and unsettled payables. Extended Admin company and existing provider-team collection reads with bounded, server-side status/company/active/name-code filters while preserving the prior unfiltered team scope shape and provider-safe projections. No Customer or Provider mobile contract was widened.

The Admin app now provides bilingual English/Arabic, RTL/LTR provider workspaces for company search/detail and service-area create/update, team search/detail/member visibility, team create/update/activation, schedule create/update/remove, capability replacement, availability status, and scoped cleaner provisioning; catalog service/extra create/update/activation; and pricing-rule/promotion publication and activation. All mutations use fixed same-origin BFF forwarding, backend DTO/permission checks, existing transactional audit/idempotency behavior, and authoritative page refresh after success. Loading/empty/error/forbidden handling remains shared with the completed Admin shell/read-model foundation. No generic state editor, financial workflow, live tracking, production integration, or later-phase operations was added.

**Phase 14D validation record:** fresh PostgreSQL clean-schema `admin-providers.test.ts` — **1/1 PASS** using `node --env-file=.env scripts/test-backend-direct.mjs admin-providers.test.ts`; backend unit suite — **42/42 PASS**; domain regression `core.test.ts pricing.test.ts provider-phase13d.test.ts` — **14/14 PASS** in a fresh migrated/seeded schema; Admin tests — **9/9 PASS**; backend build — **PASS**; Admin TypeScript/typecheck — **PASS**; Admin production build — **PASS**; installed-engine Prisma schema validation — **PASS**; direct clean-schema seed verification — **PASS** (`Seed verified: 5 roles, 38 permissions, 2 catalog drafts.`). The standard `npm test -- admin-providers.test.ts` wrapper and `npm run test:database` remained blocked before assertions by the known Windows Prisma/network child-process limitations (`ECONNREFUSED 127.0.0.1:9` for the Prisma engine download and `spawnSync node.exe EPERM` respectively); the direct runner applied all seven unchanged migrations and completed the live assertions. No migration was created.

Phase 14D is officially **COMPLETE**. Phase 14E is implemented and closed below; Phase 14F–14H remain explicitly **NOT STARTED**.

### 14E — Booking operations and dispatch commands

- Add state-aware booking commands, dispatch monitoring, automatic offer, manual dispatch, pending-offer reassignment, retry/no-team/cancel where supported.
- Make unsupported accepted/started reassignment explicit in UI.

**Gate:** duplicate-click/timeout retry uses one key; conflicts trigger detail refresh; dispatch/booking regression passes.

**Phase 14E implementation record (2026-09-22):** **COMPLETE**. Added the Admin-only `GET /admin/bookings/:id` investigation projection with bounded customer identity, immutable booking snapshots, assignment/company/team history and events, dispatch attempts, payment/refund/cash state, and booking status history. The existing filtered `GET /admin/bookings` remains the worklist. Added the bilingual Admin Dispatch route with monitoring counts, recent attempts, and pending offers. Added state-aware UI actions for automatic dispatch, reasoned manual dispatch and pending-offer reassignment, retry, no-team terminal handling, cancellation, and defined no-show commands. Accepted/started reassignment remains visibly unsupported. All mutations use the existing same-origin BFF allowlist and the existing backend command paths; no arbitrary status mutation, provider authorization widening, scoring bypass, lock bypass, or local authoritative state was introduced.

**Phase 14E validation record:** fresh PostgreSQL `admin-operations.test.ts` — **1/1 PASS**; focused Booking/Dispatch/Provider/Payments/Settlements regressions — **8/8 PASS** when run one file at a time; backend unit tests — **42/42 PASS**; Admin frontend tests — **11/11 PASS**; backend build — **PASS**; Admin TypeScript/typecheck — **PASS**; Admin production build — **PASS**; Prisma schema validation through `scripts/prisma-local.ps1 validate` — **PASS**; direct clean-schema migration and seed verification — **PASS** (`Seed verified: 5 roles, 38 permissions, 2 catalog drafts.`). No migration was created. The standard root wrapper was attempted but was blocked before test discovery by the configured Prisma binary-download proxy (`ECONNREFUSED 127.0.0.1:9`); `npm run test:database` remains blocked by Windows `spawnSync node.exe EPERM`. A combined direct-runner invocation also exposed its existing temporary-test cleanup race after all selected tests passed, so regression evidence was rerun one file at a time with clean exits. **Phase 14F–14H remain NOT STARTED.**

### 14F — Payments, refunds, cash, and settlements

- Add payment list and cash reconciliation endpoints plus settlement read projection/filter/permission refinement.
- Build finance views first, then existing retry/refund/reconcile/complete and settlement lifecycle actions.

**Gate:** no client-derived money/state, read-vs-manage authorization passes, every command is idempotent/audited, and full payment/settlement regressions pass.

**Phase 14F implementation record (2026-09-22):** **COMPLETE**. Added the Admin Finance module with permission-gated, bounded projections for payments, payment attempts/status/events, refunds/history, cash reconciliation, settlement periods/totals, provider/company payout information, immutable settlement allocations, reconciliation discrepancies, and booking/customer/provider references. Added the bilingual Admin payments, refunds, cash, and settlement routes with URL-backed filters, safe money formatting, loading/empty/error/forbidden states, read-only investigation views, confirmation-gated retry/refund/reconciliation/settlement lifecycle commands, same-origin BFF allowlisting, and authoritative refresh after mutations. Existing Payment, Booking, Refund, Cash and Settlement services remain the only command/state owners; no arbitrary status endpoint or client-side financial truth was introduced. Provider-safe settlement projections and Customer/Provider authorization boundaries were preserved.

**Phase 14F validation record:** fresh PostgreSQL `admin-finance.test.ts` — **1/1 PASS**; Payment/refund/cash/booking regression `payments.test.ts` — **1/1 PASS**; Settlement regression `settlements.test.ts` — **1/1 PASS**; Booking lifecycle regression `booking.lifecycle.test.ts` — **1/1 PASS**; Provider settlement isolation regression `provider-phase13d.test.ts` — **1/1 PASS**; backend unit tests — **42/42 PASS**; Admin tests — **12/12 PASS**; backend build — **PASS**; Admin TypeScript/typecheck — **PASS**; Admin production build — **PASS**; `scripts/prisma-local.ps1 validate` — **PASS**; direct clean-schema migration and seed verification — **PASS** (`Seed verified: 5 roles, 38 permissions, 2 catalog drafts.`). Existing payment/settlement command tests cover amount correctness, duplicate webhooks, refund idempotency, cash collection/reconciliation, settlement calculation/allocation/reconciliation, provider isolation, lifecycle transitions, locking, duplicate commands, and audit histories. No migration was created. The standard Windows Prisma wrapper and `npm run test:database` remain environment-limited by the known Prisma proxy `ECONNREFUSED 127.0.0.1:9` / nested `spawnSync node.exe EPERM`; the direct fresh-schema runner was used successfully. **Phase 14F is officially COMPLETE. Phase 14G and 14H remain NOT STARTED.**

### 14G — Notifications and location operations

- Add delivery list/detail and operations location endpoints.
- Build read-only delivery health/attempt pages and stored-location freshness/service-area view.
- Do not add notification composition, retry controls, production push, or map-provider integration.

**Gate:** token/payload redaction, provider isolation, freshness semantics, and Phase 11 regression pass.

**Phase 14G implementation record (2026-09-22):** **COMPLETE**. Added read-only Admin delivery list/detail projections at `GET /admin/notification-deliveries` and `GET /admin/notification-deliveries/:id`, plus `GET /admin/operations/locations`. Delivery reads support bounded status/type/category/recipient/reference/time filters, persisted retry/failure/timestamp state, delivery-attempt history, booking references where present, and safe event/idempotency references. Detail payload exposure is allowlisted to title/body/business references; device-token values and unrestricted payload contents are excluded. No compose, resend, retry/requeue, outbox replay, or arbitrary status command was added.

Added bilingual notification delivery and stored-location Admin pages with URL filters, loading/empty/error/forbidden states, freshness labels, safe booking links, and service-area visibility. Location freshness uses the dispatch `DISPATCH_LOCATION_MAX_AGE_MINUTES` setting and is explicitly stored-location visibility, not live GPS tracking or map-provider behavior. Location reads require the platform Admin `admin:dashboard:read` permission plus `team:manage`; notification reads require `notification:operations:read`. Existing outbox, delivery retry/idempotency, mock push provider, device-token lifecycle, team location writes, and Provider/Customer authorization were reused unchanged.

**Phase 14G validation record:** fresh PostgreSQL `admin-observability.test.ts` — **1/1 PASS**; `phase11.test.ts`, `dispatch.test.ts`, `provider-assignments.test.ts`, `provider-phase13d.test.ts`, and `booking.test.ts` — **5/5 PASS** individually; backend unit tests — **42/42 PASS**; Admin tests — **15/15 PASS**; backend build — **PASS**; Admin typecheck — **PASS**; Admin production build — **PASS**; direct clean-schema migrations and seed verification — **PASS** (`5 roles, 38 permissions, 2 catalog drafts`); no migration was created. The ordinary Prisma validation command remained environment-limited by the configured binary-download proxy (`ECONNREFUSED 127.0.0.1:9`); direct fresh-schema execution passed. **Phase 14G is officially COMPLETE. Admin 14A–14F were not rebuilt.**

### 14H — End-to-end hardening and handoff

- Completed the final hardening gap assessment and validated the existing backend, Customer Flutter, Provider Flutter and Admin implementations without redesign or feature work.
- Validated cross-role authorization, booking/dispatch state integrity, payment/refund/cash/settlement invariants, replay/idempotency, concurrency/locks, notification/outbox safety, location freshness, session security and Admin BFF boundaries.
- Re-ran full available backend unit/integration groups, Admin tests/typecheck/build, Customer/Provider tests/analyzers/Android debug builds, fresh migration/seed checks and separate-process Dispatch recovery.
- Reconciled `docs/api.md` with the actual controllers, DTOs, permissions and BFF allowlist; no endpoint contract changed.
- Recorded the detailed evidence and intentional external-service limitations in [phase14h-e2e-hardening-report.md](phase14h-e2e-hardening-report.md).

**Gate:** PASS — no regression in Customer/Provider app tests; no migration or product source change was necessary; final Phase 14 acceptance evidence is recorded. **Phase 14H is COMPLETE and is the final Admin phase.**

## 13. Exact validation plan

Run from repository root with Node/npm versions enforced by `.nvmrc` and `package.json`.

### Every backend-bearing sub-phase (14A–14G)

```powershell
npm run build:backend
npm run test:unit
npm run prisma:validate
```

`npm run prisma:validate` may fail on this Windows host with the known `spawnSync node.exe EPERM`. Record that environmental limitation; do not misreport it as a schema error. The build and clean-schema test runner generate/use Prisma through its local scripts and are the stronger functional gate.

Run the focused clean-schema file introduced for that sub-phase, for example:

```powershell
npm test -- admin-foundation.test.ts
npm test -- admin-read-models.test.ts
npm test -- admin-customers.test.ts
npm test -- admin-providers.test.ts
npm test -- admin-operations.test.ts
npm test -- admin-finance.test.ts
npm test -- admin-observability.test.ts
```

These filenames are planned and must be created with the corresponding sub-phase. The root runner rejects unknown or duplicate filenames, creates an isolated PostgreSQL schema, applies migrations/seeds, runs the selected test, and drops the schema.

### Every frontend-bearing sub-phase (14A–14H)

After Phase 14A adds the scripts:

```powershell
npm run typecheck -w @home-clean/admin
npm run test -w @home-clean/admin
npm run build:admin
```

For sub-phase-specific tests, expose a workspace script that forwards Vitest filters, then run the relevant route/component suite. Do not rely on Next build as the only frontend test.

### Domain regressions by sub-phase

- **14A:** `npm test -- auth.test.ts core.test.ts`
- **14B:** `npm test -- auth.test.ts booking.test.ts dispatch.test.ts payments.test.ts settlements.test.ts`
- **14C:** `npm test -- core.test.ts auth.test.ts`
- **14D:** `npm test -- core.test.ts pricing.test.ts provider-phase13d.test.ts`
- **14E:** `npm test -- booking.test.ts booking.lifecycle.test.ts dispatch.test.ts provider-assignments.test.ts provider-job-execution.test.ts`
- **14F:** `npm test -- payments.test.ts settlements.test.ts booking.lifecycle.test.ts provider-phase13d.test.ts`
- **14G:** `npm test -- phase11.test.ts dispatch.test.ts provider-assignments.test.ts`
- **14H full backend:** `npm test`

At 14H also run:

```powershell
npm run build
npm run test -w @home-clean/admin
npm run test:e2e -w @home-clean/admin
```

If `test:e2e` is not introduced, Phase 14 cannot claim browser E2E completion; record it as deferred rather than silently omitting it. Re-run the existing Customer and Provider Flutter test/analyzer/build commands documented in their phase records before declaring Phase 14 complete.

## 14. Dependencies, risks, and deferrals

| Item | Effect / decision |
|---|---|
| Admin user bootstrap | An Admin phone must be pre-provisioned; public OTP verification creates only `CUSTOMER`. Document a safe local bootstrap path; do not add public role selection. |
| Refresh-token races | Concurrent server requests can replay-revoke a rotated family. The BFF needs per-session refresh serialization. |
| Current role granularity | One Admin role has all mutations. Permission separation prepares least privilege but does not implement maker/checker. Defer new role enum/migration. |
| Offset pagination | Existing contract uses offset pagination and is not a consistent snapshot. Use deterministic ordering now; cursor pagination is a later API evolution. |
| Search performance | Current indexes support key operational filters, not arbitrary fuzzy search. Bound queries and measure before adding indexes/migrations. |
| Legacy finance detail | It is admin-grade and intentionally broad. Add read authorization carefully and never route it to provider/mobile clients. |
| Stored team location | It may be stale and is not continuous GPS. Show freshness and source limitations; production maps/live tracking are deferred. |
| Notification provider | Current delivery provider is mock/local. Phase 14 shows persisted delivery state only; production FCM/APNs and operator resend are deferred. |
| Payment/bank integrations | Real gateway credentials, webhook operations tooling, payout rails, and production refund operations are deferred. |
| Completion proof | Only metadata is stored; object upload/viewing needs a future storage integration. |
| Reassignment recovery | Accepted/started/terminal assignment reassignment has no state-machine edge and is explicitly deferred. |
| Support/ratings | Schema exists but service/API workflows do not. Exclude from Phase 14. |
| Windows Prisma EPERM | Native validation may hit `spawnSync node.exe EPERM`; retain build/clean-schema evidence and record the environment issue. |
| Dirty/untracked repository | Current Git reports the entire project as untracked, so history/diff cannot establish ownership. Preserve all existing files and keep Phase 14 changes narrowly documented/committed when implementation begins. |

## 15. Final checkpoint

### A. Phase 14 scope

An authenticated bilingual Admin web application for Home Clean platform staff, covering dashboard, customer/identity administration, companies/teams, supported catalog/configuration, booking investigation, dispatch, finance review/actions, notification delivery observability, location freshness, and audit governance. No production integrations or unsupported state-machine recovery are included.

### B. Existing reusable capabilities

Authentication/session enforcement, role/permission grants, customer summaries, identity provisioning/status/grants, company/team/service-area/catalog/pricing administration, rich operational booking detail, explicit booking commands, dispatch monitoring/manual/automatic offer, payment detail/refund/reconciliation, complete settlement lifecycle, notification/outbox persistence, team locations, audit writes, idempotency, locks, and domain histories already exist.

### C. Final Phase 14 status

Phase 14A security/shell, Phase 14B dashboard/read models/governance, Phase 14C customer/identity projections and commands, Phase 14D provider/company/team/catalog/configuration pages, Phase 14E booking/dispatch operations, Phase 14F finance, Phase 14G notification delivery observability/operations locations, and Phase 14H final hardening/handoff are complete for their documented scopes. External integrations and deployment responsibilities remain explicitly limited as documented in the Phase 14H report.

### D. Final stop point

No new feature phase or Admin roadmap follows Phase 14H. Stop after this final hardening and handoff.

### E. Final checkpoint

**Phase 14H checkpoint:** Phase 14A, Phase 14B, Phase 14C, Phase 14D, Phase 14E, Phase 14F, Phase 14G, and Phase 14H are complete for their documented scoped gates. Admin 14A–14G were not rebuilt. No database migration, Customer app, Provider app, or Admin application source was changed during Phase 14H.
