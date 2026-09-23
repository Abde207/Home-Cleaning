# Implemented API contract

Source inspection: 2026-09-22. Endpoints below are implemented and covered by local live acceptance. Phase 7 Pricing, scoped Phase 8 Dispatch, Phase 9 Payments + Cash, Phase 10 Settlements, Phase 11 Notifications + Location, Phase 13B Provider Assignments, Phase 13C Provider Job Execution, and Phase 14B–14H Admin scope are accepted for backend scope. Phase 14H rechecked the controller/DTO/permission/idempotency/error contracts against the implementation and introduced no endpoint change. Migration 0007 remains the latest migration; Phase 14G required no database change. See [Phase 13 Provider record](phase13-provider-app.md), [Phase 14 Admin blueprint](phase14-admin-dashboard-blueprint.md), and [Phase 14H hardening report](phase14h-e2e-hardening-report.md).

Phase 14H validation uses the repository’s direct clean-schema runner where the standard Windows Prisma wrapper is blocked by the configured binary proxy or nested `spawnSync node.exe EPERM`. External payment, push, map/geocoding/routing, OTP delivery and object-storage adapters remain mock/abstract boundaries; this contract does not claim credentialed production-provider validation.

## Common contract

All paths below are relative to `/api/v1`. GET/PUT/PATCH/DELETE return 200 on success; POST returns 201 except auth request-otp (202), verify-otp/refresh/logout (200). Protected routes require `Authorization: Bearer <opaque access token>`; the database-backed guard checks current session/user status and current roles/scopes.

Success: `{success:true,data:<response>,meta:{requestId}}`. Errors: `{success:false,error:{code,message},meta:{requestId}}`. Responses carry `x-request-id`; input request IDs must match 1–64 ASCII letters/digits/underscore/hyphen or a UUID is generated. Unknown body fields are rejected on endpoints with request DTOs. IDs in route parameters use ParseUUIDPipe. JSON bodies are limited to 64 KB. Decimal response values are JSON strings, with trailing zeros not guaranteed. Dates are ISO strings.

Every endpoint can return sanitized 500 (SYSTEM_ERROR); dependency failures may return 503. Protected endpoints add 401 (AUTH_REQUIRED), and permission/scoped checks add 403 (FORBIDDEN_RESOURCE). Body/ID failures return 400 (VALIDATION_INVALID_INPUT), missing/foreign resources 404 (RESOURCE_NOT_FOUND), uniqueness conflicts 409 (CONFLICT_OPERATION), oversized bodies 413 (VALIDATION_TOO_LARGE). Tables list additional applicable errors; shared errors apply to every row. No raw SQL errors or stack traces are returned.

Booking commands consume a bounded `Idempotency-Key` header and replay the stored response for the same actor, operation and request hash; reusing a key with different input returns `409 IDEMPOTENCY_KEY_REUSED`. Other existing commands retain their documented behavior. Read-only routes are idempotent. “State converges” means repeated writes target the same state unless a route explicitly documents idempotent replay.

Core entity lists accept `?limit=1..100&offset=0..1000000` (defaults 100/0), retain array responses, and use deterministic ordering. This applies to customers, addresses, properties, users, catalog/extras, companies/areas, teams/members/availability and customer/operational bookings. Role grants and capability IDs return their complete sets. Unknown query fields on paginated routes are rejected. Offset pages are not a consistent snapshot across concurrent writes. Booking status changes use explicit commands; no arbitrary booking status PATCH exists.

## Role and scope notation

- Public: no authentication.
- Authenticated: any valid session, no specific role.
- Customer: CUSTOMER with the stated own-resource permission and server-derived customer identity.
- Admin: HOME_CLEAN_ADMIN with the stated permission under the seeded role mapping.
- Manager: COMPANY_MANAGER, active company and matching company scope, with team:company.
- Cleaner: TEAM_LEADER_CLEANER, active company/team and matching team scope.
- Permissions are evaluated from persisted grants, not client-supplied role/company fields. A seeded dispatcher has no service/company/identity management rights.
- Phase 14A strengthens existing `/admin/**` controllers with `PlatformPermission`: the required permission must be on the **same active, unscoped `HOME_CLEAN_ADMIN` grant** (`companyId` and `teamId` null). A scoped or misconfigured non-Admin grant cannot enter those routes. The existing provider and customer endpoints retain their prior scope rules.
- Phase 14A idempotently seeds `admin:dashboard:read`, `identity:read`, `payment:read`, `refund:read`, `cash:read`, `settlement:read`, and `notification:operations:read` for `HOME_CLEAN_ADMIN`. Phase 14B uses `admin:dashboard:read`, `booking:operations`, `audit:read`, and `identity:read`/`identity:manage` for its read models; later finance/notification/location read refinements remain in their assigned phases.

## Phase 14A Admin BFF session boundary

The Next.js Admin application exposes the following **same-origin application routes**, not additional NestJS `/api/v1` endpoints. They forward to the existing authentication API. All response bodies exclude opaque access and refresh tokens. Session cookies are `HttpOnly`, `SameSite=Strict`, `Secure` in production, and path-scoped (`hc_admin_access` at `/`, `hc_admin_refresh` at `/api/session`). Mutating requests require an exact same-origin `Origin` header and reject cross-site `Sec-Fetch-Site`. JSON bodies are bounded to 4096 characters. Errors use a sanitized `{success:false,error:{code,message},meta:{requestId}}` shape.

| Method / path | Auth / role | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `POST /api/session/otp` | Public; no role supplied | `{phone}` E.164-shaped | `{success:true,data:{challengeId,expiresAt}}` | 400 malformed/extra fields; 403 cross-origin; backend 429/503 | Backend creates a new challenge for each accepted call | Existing OTP challenge/delivery; no Admin cookie |
| `POST /api/session/verify` | Public challenge; **requires an active unscoped `HOME_CLEAN_ADMIN` grant after verification** | `{challengeId: UUID,code: six digits}` | `{success:true,data:{id,locale}}` plus HTTP-only cookies | 400 malformed/extra fields; 401 invalid code; 403 non-Admin/cross-origin; 429/503 | OTP is one-time; not replayable | Existing backend session; non-Admin session is revoked and no Admin cookie is retained |
| `POST /api/session/refresh` | Refresh cookie; live platform-Admin grant rechecked through `/auth/me` | No body | `{success:true,data:{refreshed:true}}` plus rotated HTTP-only cookies | 401 invalid/revoked session; 403 lost Admin grant/cross-origin; 429/503 | One-time backend rotation; same-process concurrent requests with the same old cookie are coalesced | Replaces cookies after backend rotation; clears cookies on 401/403 |
| `POST /api/session/logout` | Access cookie, or expired/invalid session | No body | `{success:true,data:{signedOut:true}}` | 403 cross-origin; 503 when backend revocation cannot be confirmed | Backend family revocation is state-convergent; invalid access is treated as signed out | Revokes backend family when accessible; clears both cookies only after success or already-invalid access |

The protected Next layout calls existing `GET /api/v1/auth/me` on every server render and requires the platform Admin grant. The permission-aware navigation is presentation only; NestJS continues to authorize each business endpoint. No Phase 14 dashboard or domain API was added in 14A. Refresh coalescing is process-local; multi-instance deployment requires a shared coordinator/result handoff before horizontal scaling.

## Phase 14B Admin read models and governance

The following read-only endpoints are implemented for the Phase 14B Admin dashboard, operational booking investigation, and governance screens. They use dedicated Admin-safe projections, return the common `{success,data,meta}` envelope, have no idempotency key, create no `AuditLog` rows, and preserve the existing backend authorization boundary.

| Method/path | Authentication / permission | Request DTO | Response DTO | Validation / errors | Idempotency / side effects / audit |
|---|---|---|---|---|---|
| `GET /admin/dashboard` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `admin:dashboard:read` | `AdminDashboardQueryDto {from?,to?}`; ISO-8601 instants, maximum 31 days, `from < to`; default current UTC day through now | `{generatedAt,range,bookingsByStatus[],assignmentsByStatus[],attention,finance,providers,notifications,recentDispatchAttempts[]}`; counts and server-derived states only | 400 `ADMIN_DATE_RANGE_INVALID`; 401/403/common errors; 503 dependency failure | Read-only; no idempotency; access logging/request ID only |
| `GET /admin/bookings` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `booking:operations` | `AdminBookingListQueryDto {limit,offset,status?,paymentMethod?,companyId?,teamId?,customerId?,serviceId?,scheduledFrom?,scheduledTo?,createdFrom?,createdTo?,bookingNumber?}`; limit default 50, bounded 1..100; date pairs ordered; company/team relationship validated | `AdminBookingSummary[]` with booking fields, customer identity/status, service names, latest assignment company/team, and latest payment method/status; no snapshots or provider payloads | 400 invalid enum/date/filter/UUID or `ADMIN_FILTER_RELATION_INVALID`; empty filter result is 200 `[]`; 401/403/common errors | Read-only; no idempotency; access logging/request ID only |
| `GET /admin/audit-logs` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `audit:read` | `AuditLogQueryDto {limit,offset,actorUserId?,action?,resourceType?,resourceId?,requestId?,createdFrom?,createdTo?}`; bounded fields; default maximum 90-day range unless actor/resource is specified | `AuditLogSummary[] {id,actor?,action,resourceType,resourceId,reason,requestId,createdAt}`; before/after omitted | 400 invalid UUID/date/range/length; empty result is 200 `[]`; 401/403/common errors | Read-only; no idempotency; never recursively audits audit reads; access logging/request ID only |
| `GET /admin/audit-logs/:id` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `audit:read` | UUID path | Audit summary plus redacted `{before,after}` payloads | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; recursive denylist redacts token, OTP/code, secret, credential, password, signature, payload, and device-token keys; access logging only |
| `GET /admin/users` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `identity:read` or `identity:manage` | Existing `ListQueryDto` | Existing `UserSummary[]` | 401/403/common errors | Read-only; mutations remain `identity:manage` |
| `GET /admin/users/:id/roles` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `identity:read` or `identity:manage` | UUID path | Existing `RoleGrant[]` | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; mutations remain `identity:manage` |

The existing customer/provider-safe `GET /bookings/:id` contract is unchanged. Admin investigation uses the separate `GET /admin/bookings/:id` projection documented below so company/team names, assignment events, dispatch attempts, payment state and safe customer identity are not widened into other clients.

## Phase 14E Admin booking operations and dispatch

Phase 14E adds no new state machine. All mutations reuse the existing Booking/Dispatch commands, row locks, eligibility/scoring policy, idempotency records, histories, outbox events and audit actions. The Admin UI is bilingual and uses the same-origin command BFF; the browser never receives a backend bearer token.

| Method/path | Authentication / permission | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `GET /admin/bookings/:id` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `booking:operations` | UUID path | `AdminBookingDetail` with safe customer/service identity, immutable snapshots, assignments with company/team safe names and events/proofs, booking history, dispatch attempts, payments/transactions/refunds/cash collection | 400 invalid UUID; 404 missing; 401/403/common errors; no provider payloads or credentials | Read-only; no key; no state change | None; access logging/request ID only |
| `GET /dispatch/monitoring` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN` or `DISPATCHER`; `dispatch:manage` | None | `{bookings:[{status,_count{_all}}],assignments:[{status,_count{_all}}],recentAttempts[]}`; latest 100 attempts | 401/403/common errors | Read-only; no key | None |
| `POST /dispatch/bookings/:id/offer` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN` or `DISPATCHER`; `dispatch:manage` | None | `OperationalBooking` | UUID; required key; 409 active offer, invalid state/slot, retry limit, terminal `NO_TEAM_AVAILABLE`, or accepted/started reassignment; 404 missing | Required `Idempotency-Key`; same actor/operation/key and request hash replays; mismatch is 409 | Existing automatic dispatch selection, assignment/event/attempt, booking history, audit and outbox under Booking/team locks |
| `POST /dispatch/bookings/:id/manual` | Same | `ManualDispatchDto {companyId: UUID,teamId: UUID,reason: 1..500 nonblank,overrideAvailabilityAndArea?: boolean}` | `OperationalBooking` | Server rechecks booking state, target company/team, capability, availability, area and capacity; 409 includes `MANUAL_TEAM_NOT_ELIGIBLE`, terminal no-team or accepted/started reassignment | Required key; replay/mismatch check | Existing reasoned manual offer or pending-offer reassignment; override is explicitly audited; assignment/history/attempt/audit/outbox transaction |
| `POST /bookings/:id/retry-assignment` | Same; `dispatch:manage` or `booking:operations` | None | `BookingSummary` | Must be `REJECTED` or `TEAM_NO_SHOW`; UUID/key/common errors | Required key; replay/mismatch check | Explicit `RetryAssignment`: status/history/audit/outbox |
| `POST /bookings/:id/no-team-available` | Same; `dispatch:manage` or `booking:operations` | None | `BookingSummary` | Must be `SEARCHING_FOR_TEAM` | Required key; replay/mismatch check | Explicit terminal `NO_TEAM_AVAILABLE`: status/history/audit/outbox |
| `POST /bookings/:id/cancel` | Same; `booking:operations` (customer `booking:own` remains supported) | `CancelBookingDto {reason?: 1..500}` | `BookingSummary` | Explicit state-machine transition only; terminal/invalid state returns 409 | Required key; replay/mismatch check | Explicit cancellation with reason, version/history/audit |
| `POST /assignments/:id/team-no-show` | Same; `booking:operations` or provider assignment scope | None | `BookingSummary` | Accepted assignment and `TEAM_ON_THE_WAY` required | Required key; replay/mismatch check | Assignment cancellation/event plus `TEAM_NO_SHOW` history/audit/outbox |
| `POST /assignments/:id/customer-no-show` | Same; `booking:operations` or provider assignment scope | None | `BookingSummary` | Accepted assignment and `CLEANING_STARTED` required | Required key; replay/mismatch check | Assignment cancellation/event plus terminal `CUSTOMER_NO_SHOW` history/audit/outbox |

The Admin Next.js same-origin command proxy exposes `POST /api/admin/command/{allowlisted-backend-path}` for `dispatch/bookings/:id/offer`, `dispatch/bookings/:id/manual`, `bookings/:id/retry-assignment`, `bookings/:id/no-team-available`, `bookings/:id/cancel`, `assignments/:id/team-no-show`, and `assignments/:id/customer-no-show`. It enforces same-origin protection, a fixed UUID/path allowlist, sanitized errors, and server-only cookie forwarding. The UI generates one key per unchanged command payload, retains it after transport failure, confirms consequential commands, and reloads the authoritative detail after success or a 409 conflict. There is intentionally no generic booking status PATCH and no accepted/started/terminal reassignment bypass.

## Phase 14F Admin finance

These read routes use the existing HTTP-only Admin session boundary and require an unscoped platform `HOME_CLEAN_ADMIN` grant. Read routes are idempotent and have no side effects. Decimal money values remain backend decimal strings; the Admin frontend only formats them for display.

| Method/path | Authentication / permission | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `GET /admin/payments` | Bearer session; `payment:read` or `payment:manage` | `AdminPaymentQueryDto {limit,offset,status?,method?,bookingId?,bookingNumber?,customerId?,companyId?,createdFrom?,createdTo?,hasRefund?,cashState?}` | `AdminPaymentSummary[]` with booking/customer refs, method/status/amount/currency/provider reference, refund total and cash collection | Bounded pagination/enums/UUIDs/ISO dates; 400 invalid query; 401/403/common errors | Read-only; no key | None; safe projection only; no checkout URL, request key, raw provider payload or payload hash |
| `GET /admin/payments/:id` | Same `payment:read` or `payment:manage` | UUID path | `AdminPaymentDetail` with safe attempts, status history, event summaries, transactions, refunds/history, cash collection and settlement allocations | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; no key | None |
| `GET /admin/refunds` | Bearer session; `refund:read`, `refund:manage`, or `payment:manage` | `AdminRefundQueryDto {limit,offset,status?,paymentId?,bookingId?,customerId?,companyId?,createdFrom?,createdTo?}` | Safe refund summaries with payment/booking/customer references | Bounded pagination/enums/UUIDs/ISO dates; 400/401/403/common errors | Read-only; no key | None |
| `GET /admin/cash-reconciliation` | Bearer session; `cash:read` or `payment:manage` | `AdminCashQueryDto {limit,offset,state?,companyId?,teamId?,bookingId?,scheduledFrom?,scheduledTo?}` | `AdminCashItem[]` with server-derived state, expected amount, assignment, collection and exception codes | Bounded filters; 400/401/403/common errors; state is not client-derived | Read-only; no key | None; Admin cannot attest physical cash collection from this screen |
| `GET /admin/settlements` | Bearer session; `settlement:read` or `settlement:manage` | `AdminSettlementQueryDto {limit,offset,status?,companyId?,periodFrom?,periodTo?,reconciliationStatus?}` | Settlement/company summaries with authoritative total, paid amount, payout direction, counts and latest reconciliation | Bounded pagination/enums/UUIDs/ISO dates; 400/401/403/common errors | Read-only; no key | None |
| `GET /admin/settlements/:id` | Same `settlement:read` or `settlement:manage` | UUID path | `AdminSettlementDetail` with payable calculation fields, booking/customer/service refs, allocations, payouts, reconciliation runs/details and lifecycle history | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; no key | None |

Finance commands are not new Admin state APIs. The same-origin BFF allowlist forwards the existing explicit commands: `POST /payments/:id/retry` (`payment:manage`, required key), `POST /payments/:id/refunds` (`refund:manage` or `payment:manage`, `{amount,reason}`, required key), `POST /bookings/:id/start-payment-reconciliation`, `POST /bookings/:id/reconcile-payment`, `POST /bookings/:id/complete` (`payment:manage`, required key), and the existing settlement create/calculate/submit-review/approve/pay/reconcile/close/cancel/reverse commands (`settlement:manage`, required key). Domain services retain row locks, eligibility/state validation, amount/refund invariants, immutable allocations, idempotency records, histories, outbox events and audit records. Successful UI commands refresh the authoritative projection; no arbitrary PATCH status route exists.

## Phase 14G Admin notification delivery and operations locations

These are read-only, platform-scoped Admin projections. They use the existing `notification:operations:read` and `admin:dashboard:read` permissions; location reads additionally require `team:manage`. They create no audit rows, outbox events, delivery attempts, or other business side effects. No same-origin BFF command route is needed because the Next server component uses the existing server-only Admin API client; no browser credential is exposed.

| Method/path | Authentication / permission | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `GET /admin/notification-deliveries` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `notification:operations:read` | `AdminNotificationDeliveryQueryDto {limit,offset,status?,type?,category?,userId?,referenceType?,referenceId?,createdFrom?,createdTo?}` | `AdminNotificationDeliverySummary[] {id,notificationId,status,channel,attempts,lastError,nextAttemptAt,sentAt,createdAt,notification{type,category,referenceType,referenceId,eventKey,userId,readAt,deliveredAt,createdAt,booking?}}` | Bounded pagination, delivery status, strings, UUID and strict ISO instant filters; date range must be ordered; 400/401/403/common errors | Read-only; no key | None |
| `GET /admin/notification-deliveries/:id` | Same | UUID path | Summary fields plus `providerReference`, `attemptsHistory[{id,attemptNumber,status,providerReference,error,createdAt}]`, and `safePayload {title?,body?,data:{type?,eventId?,aggregateId?}}` | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; no key | None |
| `GET /admin/operations/locations` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `admin:dashboard:read` plus `team:manage` | `AdminLocationsQueryDto {limit,offset,companyId?,teamId?,teamStatus?,freshness?,locationAvailability?}`; freshness `FRESH|STALE|NEVER_REPORTED`, availability `AVAILABLE|MISSING` | `{generatedAt,locationMaxAgeMinutes,teams:[{id,name,internalCode,status,active,company,latitude,longitude,locationAt,freshness}],serviceAreas:[{id,name,latitude,longitude,radiusKm,active,company}]}` | Bounded pagination, UUIDs and enum filters; 400/401/403/common errors | Read-only; no key | None |

Notification projections deliberately exclude device-token values and unrestricted payloads. The detail allowlist exposes only title, body, and event/aggregate business references. `status`, `attempts`, `nextAttemptAt`, `lastError`, and attempt history are persisted delivery state; `readAt`/`deliveredAt` are persisted notification state. The current provider is `MockPushNotificationProvider` (`mock`), so `SENT` and provider references describe local/mock behavior, not FCM/APNs production delivery. There is no Admin compose, replay, retry/requeue, or arbitrary status mutation.

Location freshness uses the same server-side `DISPATCH_LOCATION_MAX_AGE_MINUTES` setting as dispatch. Coordinates are the last stored Team values; `FRESH`, `STALE`, and `NEVER_REPORTED` are server-derived. The endpoint is not live GPS tracking and performs no map-provider integration. Service-area coordinates use the existing Admin-safe projection.

## Phase 14C Admin customers and identity

These endpoints preserve the common `{success,data,meta}` envelope and the backend authorization boundary. Reads are projection-only and create no audit rows. Identity writes are explicit commands, transactionally audited, and remain `identity:manage` only.

| Method/path | Authentication / permission | Request DTO | Response DTO | Validation / errors | Idempotency / side effects / audit |
|---|---|---|---|---|---|
| `GET /admin/customers` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `customer:read` | `AdminCustomerQueryDto {limit,offset,status?,locale?,query?}`; bounded query is phone exact/prefix or case-insensitive name contains | `{id,userId,name,phone,locale,status,createdAt,bookingCount,lastBookingAt}[]` | 400 invalid enum/locale/query/pagination; 401/403/common errors; empty result is 200 `[]` | Read-only; no idempotency; access logging/request ID only |
| `GET /admin/customers/:id` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `customer:read` | UUID path | Customer list fields plus `counts {addresses,properties,bookings}` and `recentBookings` up to 10 using the safe booking summary; no address/property records | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; no idempotency; access logging/request ID only |
| `GET /admin/users` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `identity:read` or `identity:manage` | `AdminUserQueryDto {limit,offset,status?,role?,query?}`; bounded phone-prefix/name search | Existing `{id,name,phone,status}[]` | 400 invalid enum/role/query/pagination; 401/403/common errors | Read-only; no idempotency; access logging/request ID only |
| `POST /admin/users` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `identity:manage` | `ProvisionUserDto` | `{id,name,status}` | DTO validation; `VALIDATION_ROLE_SCOPE`; missing role/team/company errors | Concurrent same-phone retries reuse identity/grant under existing locks; transactional `IDENTITY_PROVISIONED` audit; customer/team membership as applicable |
| `PUT /admin/users/:id/status` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `identity:manage` | `UserStatusDto {status}` | `{id,status}` | UUID/DTO validation; 404 missing | Explicit status command; non-active status atomically revokes active sessions and records `USER_STATUS_CHANGED` audit |
| `DELETE /admin/users/:id/roles/:grantId` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `identity:manage` | UUID path | `{revoked:true}` | UUID validation; 404 missing/wrong user/grant | Explicit grant command; deactivates matching cleaner membership, revokes sessions, and records `IDENTITY_ROLE_REVOKED` atomically; no replay contract |

The Admin frontend uses same-origin BFF routes for the three mutations (`POST /api/admin/users`, `PUT /api/admin/users/:id/status`, and `DELETE /api/admin/users/:id/roles/:grantId`). These routes do not replace backend authorization; they keep bearer tokens server-side, enforce same-origin requests, and return sanitized errors. Confirmation warnings explain session revocation and provider role scope. No address/property editor is part of Phase 14C.

## Phase 14D Admin providers, teams, catalog and supported configuration

Phase 14D reuses the existing transactional Core and Pricing commands. Reads are purpose-built or existing safe projections; privileged writes remain backend-authorized, transactionally audited where the underlying command already audits, and are refreshed authoritatively by the Admin UI. No Phase 14D endpoint changes Customer or Provider mobile contracts.

| Method/path | Authentication / permission | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `GET /admin/companies` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `company:manage` | `AdminCompanyQueryDto {limit,offset,status?,query?}`; query 1..120 characters, case-insensitive name/internal-code search | `CompanyRecord[]` ordered by internal code then id; includes Admin-only commission rate | 400 invalid enum/query/pagination; 401/403/common errors; empty result is 200 `[]` | Read-only; no idempotency; access logging/request ID only | None |
| `GET /admin/companies/:id` | Bearer session; unscoped platform `HOME_CLEAN_ADMIN`; `company:manage` | UUID path | `AdminCompanyDetail {id,internalCode,name,status,commissionRate,createdAt,updatedAt,counts{teams,activeTeams,activeManagers,openAssignments,unsettledPayables},serviceAreas[]}` | 400 invalid UUID; 404 missing; 401/403/common errors | Read-only; no idempotency; access logging/request ID only | None; counts and areas are server-derived |
| `GET /provider/teams` (Admin query extension) | Admin `team:manage`, Dispatcher `team:read`, or existing scoped provider permission | `AdminTeamQueryDto {limit,offset,companyId?,status?,active?,query?}`; query 1..120 characters; all filters are combined with the existing actor scope | Existing `TeamSummary[]`, deterministic id ordering; provider-safe fields unchanged | 400 invalid UUID/enum/boolean/query/pagination; 403 existing scope failure; empty result is 200 `[]` | Read-only; no idempotency; access logging/request ID only | None |
| `GET /provider/teams/:id/members` | Existing Admin/Dispatcher/provider team read scope | Existing `ListQueryDto` | `Member[] {id,name,role}` for active members with active users | 400 UUID/pagination; 403/404 existing scope behavior | Read-only | None |
| `GET /provider/teams/:id/availability` | Existing Admin/Dispatcher/provider team read scope | Existing `ListQueryDto` | `Availability[] {id,startsAt,endsAt,available}` | 400 UUID/pagination; 403/404 existing scope behavior | Read-only | None |
| `GET /provider/teams/:id/capabilities` | Existing Admin/Dispatcher/provider team read scope | None | `{serviceIds: UUID[]}` | 400 UUID; 403/404 existing scope behavior | Read-only | None |

Existing Admin/provider commands used by the Phase 14D pages retain their contracts: `POST/PUT /admin/companies`, `POST/PUT /admin/companies/:id/service-areas`, `POST/PUT /provider/teams`, `POST/PUT/DELETE /provider/teams/:id/availability`, `PUT /provider/teams/:id/capabilities`, `PUT /provider/teams/:id/availability-status`, `POST/PUT /admin/services`, `POST/PUT /admin/services/:id/extras`, `POST /admin/pricing/rules`, `POST /admin/pricing/rules/:id/activation`, `POST /admin/promotions`, and `POST /admin/promotions/:id/activation`. Their DTOs are documented below and in the existing Core/Pricing tables. Core writes use the existing scoped transactions and audit actions; Pricing publication/activation requires a bounded `Idempotency-Key` and replays the stored result for the same actor, operation and request hash. No generic status editor or financial mutation was added.

The Admin Next.js application exposes one fixed same-origin command proxy, `POST|PUT|DELETE /api/admin/command/{allowlisted-backend-path}`, for these 14D/14E mutations plus `POST /api/admin/users` when provisioning a team member. It requires an exact same-origin request, keeps the bearer access token server-side, forwards a validated optional idempotency key, and allows only the documented company/team/catalog/pricing/booking/dispatch/user command path patterns. Backend authorization and DTO validation remain authoritative. Successful commands trigger a fresh server read; failures preserve the backend error code and request ID.

## Request DTOs and validation

All listed fields are required unless marked optional. No implicit conversion of numbers to money strings.

| DTO | Fields and validation |
|---|---|
| RequestOtpDto | phone: E.164-shaped string, + and 8–15 digits |
| VerifyOtpDto | challengeId: UUID v4; code: exactly six digits |
| RefreshDto | refreshToken: string, 40–100 characters |
| ProfileDto | optional name: 1–120 characters; optional locale: ar or en; explicit null rejected |
| AddressDto | label: 1–80; addressText: 1–2000; numeric latitude [-90,90], longitude [-180,180] |
| PropertyDto | type: APARTMENT/HOUSE/VILLA/OFFICE; size: positive decimal string, up to 8 integer and 2 fractional digits; rooms/bathrooms: integers 0–1000 |
| ServiceDto | code: uppercase letter followed by 1–59 uppercase letters/digits/underscores; name/nameAr: 1–120; description: string up to 4000; basePrice: nonnegative string up to 10 integer/2 fractional digits; durationMinutes: integer 1–1440; active: boolean |
| ServiceExtraDto | same code/name/nameAr rules; price: same decimal rules as basePrice; active: boolean |
| CompanyDto | internalCode: 2–40 uppercase letters/digits/hyphens; name: 1–160; status: PENDING/ACTIVE/SUSPENDED/INACTIVE; commissionRate: string from 0 to 1 with up to 4 fractional digits |
| TeamDto | companyId: UUID v4; internalCode: company-code format; name: 1–120; capacity: integer 1–100 |
| AvailabilityDto | startsAt/endsAt: strict ISO8601 datetime with explicit Z or numeric timezone offset; end after start; available: boolean |
| CapabilitiesDto | serviceIds: unique array, at most 100 UUID v4 values; empty array allowed |
| TeamStatusDto | status: AVAILABLE/BUSY/OFFLINE/PAUSED |
| ServiceAreaDto | name: 1–120; numeric coordinates within latitude/longitude bounds; radiusKm: positive decimal string, up to 5 integer/3 fractional digits; active: boolean |
| ProvisionUserDto | phone as RequestOtpDto; name: 1–120; role: one of five roles; companyId/teamId optional UUID v4. Providers require company; only cleaner requires/allows team; team must belong to company |
| UserStatusDto | status: ACTIVE/SUSPENDED/DEACTIVATED |
| BookingExtraInputDto | serviceExtraId: UUID v4; quantity: integer 1–100 |
| CreateBookingDto | serviceId/propertyId/addressId: UUID v4; scheduledAt: strict timezone-bearing ISO datetime in the future; optional instructions up to 2000; extras: unique array up to 50; optional quoteId UUID v4; optional promotionCode uppercase letters/digits/underscore/hyphen 1–40; explicit null rejected for quoteId/promotionCode |
| QuoteRequestDto | serviceId/propertyId/addressId: UUID v4; extras: unique array up to 50 with quantity 1–100; optional promotionCode as above |
| CancelBookingDto | optional reason: 1–500 characters |

## Response DTO projections

These names document explicit JSON projections. Services use field allowlists (including `core.projections.ts`) and inferred TypeScript result types; ORM model fields are not automatically exposed.

| Name | Fields inside data |
|---|---|
| Profile | id, name (nullable), phone, locale |
| Identity | Profile plus scopes[{role, companyId (nullable), teamId (nullable), permissions[]}] |
| Tokens | accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, tokenType='Bearer' |
| Address | id, label, addressText, latitude, longitude |
| Property | id, type, size, rooms, bathrooms |
| PublicService | id, code, name, nameAr, description (nullable), basePrice, durationMinutes, extras[{id,name,nameAr,price}] (active extras only) |
| ServiceRecord | id, code, name, nameAr, description (nullable), active, basePrice, durationMinutes |
| Extra | id, code, name, nameAr, price, active |
| CompanyRecord | id, internalCode, name, status, commissionRate |
| AdminCompanyDetail | CompanyRecord plus createdAt, updatedAt, counts{teams,activeTeams,activeManagers,openAssignments,unsettledPayables}, serviceAreas[] |
| Area | id, name, latitude, longitude, radiusKm, active |
| TeamSummary | id, companyId, internalCode, name, status, capacity, active |
| CreatedTeam | Same as TeamSummary |
| Member | id, name, role |
| Availability | id, startsAt, endsAt, available |
| UserSummary | id, name (nullable), phone, status |
| ProvisionedUser | id, name (nullable), status |
| BookingSummary | id, bookingNumber, status, paymentMethod, price, currency, scheduledAt, estimatedEndAt, createdAt |
| BookingDetail | BookingSummary plus customer/service/property/address IDs, instructions, version, immutable snapshots, extras, priceSnapshot, status history, assignment history/events/proofs and separate payment/transaction/refund/cash projections |

## Health and authentication

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /health/live | Public | None | {status:'ok'} | Common errors | Read-only | None; does not query dependencies |
| GET /health/ready | Public | None | {status:'ready'} | 503 SYSTEM_NOT_READY if PostgreSQL query or Redis PING fails | Read-only | Dependency probes |
| POST /auth/request-otp | Public | RequestOtpDto | {challengeId,expiresAt} | Phone validation; 429 AUTH_RATE_LIMITED; 503 AUTH_DELIVERY_UNAVAILABLE | New challenge each accepted request | Redis counters; challenge row; development file or configured SMS; marks challenge used if delivery fails |
| POST /auth/verify-otp | Public | VerifyOtpDto | Tokens | 401 AUTH_INVALID_CODE for invalid/expired/used/locked challenge or inactive user; 429 | Single use; replay rejected | Locks challenge, persists failed attempts, consumes valid code, creates CUSTOMER identity only for a new phone, creates session |
| POST /auth/refresh | Public | RefreshDto | Tokens | 401 AUTH_INVALID_SESSION; 429 | Single use; replay revokes family | Rotates session under family lock; stores token hashes |
| POST /auth/logout | Authenticated | None | {revoked:true} | Common protected errors | Revokes family; revoked-token retry gets 401 | Family lock and revocation |
| GET /auth/me | Authenticated | None | Identity | Common protected errors | Read-only | None |

OTP lifetime is five minutes with five incorrect attempts per challenge. Limits are per 15-minute window: request IP 20, phone 3, verify IP 60, refresh IP 120. Access tokens last at most 15 minutes; refresh family expires after 30 days. Raw tokens/codes are not returned from profile APIs. Request/verify/refresh/me set Cache-Control: no-store.

## Customers

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /customers/me | Customer; profile:own | None | Profile | Guard | Read-only | None |
| PATCH /customers/me | Customer; profile:own | ProfileDto | Profile | DTO | State converges | Updates own user name/locale |
| GET /customers/me/addresses | Customer; address:own | None | Address[] | 404 if customer missing | Read-only | Lists unarchived own addresses |
| POST /customers/me/addresses | Customer; address:own | AddressDto | Address | DTO; 404 if customer missing | Not deduplicated | Creates own address |
| PUT /customers/me/addresses/:id | Customer; address:own | AddressDto | Address | DTO/UUID; 404 missing, foreign or archived | State converges | Replaces saved address fields |
| DELETE /customers/me/addresses/:id | Customer; address:own | None | {archived:true} | UUID; 404 missing/foreign | Archived state converges; timestamp changes | Soft archive, preserves booking references |
| GET /customers/me/properties | Customer; property:own | None | Property[] | 404 if customer missing | Read-only | Lists unarchived own properties |
| POST /customers/me/properties | Customer; property:own | PropertyDto | Property | DTO; zero size rejected | Not deduplicated | Creates own property |
| PUT /customers/me/properties/:id | Customer; property:own | PropertyDto | Property | DTO/UUID; 404 missing, foreign or archived | State converges | Replaces property fields |
| DELETE /customers/me/properties/:id | Customer; property:own | None | {archived:true} | UUID; 404 missing/foreign | Archived state converges; timestamp changes | Soft archive |

Address replacement currently uses PUT, refining the proposed PATCH route to require a full AddressDto. Property/address identity is derived server-side; submitted customerId is rejected. Archiving or editing saved data does not update booking snapshots.

## Bookings — Engineering Phase 6 backend

All Booking commands require `Idempotency-Key: 1..128` using ASCII letters, digits, `.`, `_`, `:` or `-`. Replaying the same key for the same authenticated actor, operation and request hash returns the stored response. Reusing a key with different input returns `409 IDEMPOTENCY_KEY_REUSED`. Booking commands use database row locks and append status history/audit records transactionally.

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /bookings | Customer booking:own, or operational actor booking:operations | ListQueryDto | BookingSummary[] | Pagination; 403 without scope | Read-only | Customer ownership or operational scope filter |
| GET /bookings/:id | Customer booking:own, or operational actor booking:operations | None | BookingDetail | UUID; 404 missing/foreign | Read-only | Explicit projection includes historical snapshots, extras, price snapshot and status history |
| POST /bookings | Customer booking:own | CreateBookingDto | BookingDetail | Required key; 404 foreign/inactive source or quote; 400 invalid schedule; 409 expired/used/mismatched quote or unavailable promotion | Replay by key | Consumes supplied or newly evaluated durable quote; creates REQUESTED booking, historical snapshots, consumption, promotion usage, history and audit atomically |
| POST /bookings/:id/confirm | Customer booking:own | None | BookingSummary | UUID; required key; 404 foreign; 409 invalid transition | Replay by key | Explicit `ConfirmBooking`: REQUESTED → PRICE_CONFIRMED; version/history/audit transaction |
| POST /bookings/:id/select-cash | Customer booking:own | None | BookingSummary | UUID; required key; 404 foreign; 409 invalid transition | Replay by key | Explicit `SelectCashPayment`: PRICE_CONFIRMED → CASH_SELECTED and separate Payment cash intent atomically |
| POST /bookings/:id/quote-confirmed | Pricing boundary pricing:manage | QuoteConfirmationDto | BookingSummary | Exact arithmetic and exact match to append-only server snapshot; 409 mismatch | Replay by key | Explicit server-owned quote handoff; REQUESTED → PRICE_CONFIRMED; no historical snapshot mutation |
| POST /bookings/:id/start-online-payment | Customer booking:own | None | BookingSummary | Must be PRICE_CONFIRMED; 409 invalid transition | Replay by key | Creates separate ONLINE/PENDING Payment and moves to PAYMENT_PENDING |
| POST /bookings/:id/payment-confirmed | Payment boundary payment:manage | PaymentConfirmationDto | BookingSummary | Trusted provider identifiers/hash; payment must be pending online | Replay by key | PaymentEvent + PaymentTransaction + CONFIRMED payment; PAYMENT_PENDING → PAYMENT_CONFIRMED |
| POST /bookings/:id/cash-payment-confirmed | Payment boundary payment:manage | PaymentConfirmationDto | BookingSummary | Cash intent must be selected; receipt remains separate | Replay by key | Records cash authorization event/transaction; CASH_SELECTED → PAYMENT_CONFIRMED |
| POST /bookings/:id/assign | Dispatcher/admin dispatch:manage | LegacyManualAssignmentDto | OperationalBooking | Compatibility alias to Dispatch manual policy; mandatory nonblank reason, exact stored slot, future expiry, area/availability and capacity; 409 terminal no-team or accepted/started job | Required key; replay/mismatch check | Booking-owned reasoned offer or pending-offer reassignment; full assignment/history/audit/outbox transaction |
| POST /bookings/:id/no-team-available | Dispatcher/admin dispatch:manage | None | BookingSummary | Must be SEARCHING_FOR_TEAM | Replay by key | Explicit terminal NO_TEAM_AVAILABLE |
| POST /bookings/:id/retry-assignment | Dispatcher/admin dispatch:manage | None | BookingSummary | Must be REJECTED or TEAM_NO_SHOW | Replay by key | Moves to SEARCHING_FOR_TEAM |
| POST /assignments/:id/accept | Scoped provider assignment or operations | None | Assignment | Assignment scope; OFFERED, unexpired offer and operational team/company only | Replay by key | Assignment ACCEPTED + event; TEAM_ASSIGNED → TEAM_ACCEPTED |
| POST /assignments/:id/reject | Scoped provider assignment or operations | CancelBookingDto | Assignment | Assignment scope; OFFERED only | Replay by key | Assignment REJECTED + event; TEAM_ASSIGNED → REJECTED |
| POST /assignments/:id/on-the-way | Scoped provider job/assignment or operations | None | BookingSummary | Accepted assignment and state | Replay by key | TEAM_ACCEPTED → TEAM_ON_THE_WAY |
| POST /assignments/:id/start-cleaning | Scoped provider job/assignment or operations | None | BookingSummary | Accepted assignment; TEAM_ON_THE_WAY; team/company still operational and team still service-capable | Replay by key | TEAM_ON_THE_WAY → CLEANING_STARTED |
| POST /assignments/:id/complete-cleaning | Scoped provider job/assignment or operations | None | Assignment | Accepted assignment and state | Replay by key | Assignment COMPLETED + event; CLEANING_STARTED → CLEANING_COMPLETED |
| POST /assignments/:id/completion-proof | Scoped provider job/assignment or operations | CompletionProofDto | CompletionProof | Completed assignment; metadata only | Replay by key | Stores proof metadata; object storage remains external |
| POST /assignments/:id/team-no-show | Scoped provider job/assignment or operations | None | BookingSummary | On-the-way state | Replay by key | Assignment CANCELLED + event; → TEAM_NO_SHOW |
| POST /assignments/:id/customer-no-show | Scoped provider job/assignment or operations | None | BookingSummary | Cleaning-started state | Replay by key | Assignment CANCELLED + event; → CUSTOMER_NO_SHOW |
| POST /bookings/:id/start-payment-reconciliation | Payment boundary payment:manage | None | BookingSummary | Completed assignment required | Replay by key | CLEANING_COMPLETED → PAYMENT_RECONCILIATION |
| POST /assignments/:id/collect-cash | Scoped cash provider or payment operations | CashCollectionDto | CashCollection | Exact historical amount; completed assignment | Replay by key | CashCollection + CASH_COLLECTED payment; starts reconciliation when needed |
| POST /bookings/:id/reconcile-payment | Payment boundary payment:manage | None | BookingDetail | Verified payment/cash collection required | Replay by key | Marks Payment RECONCILED |
| POST /bookings/:id/complete | Payment boundary payment:manage | None | BookingSummary | Reconciled payment required; completion proof is optional | Replay by key | PAYMENT_RECONCILIATION → COMPLETED |
| POST /bookings/:id/refund | Refund boundary refund:manage | RefundDto | Refund | Reconciled payment; amount bounded by payment | Replay by key | Creates pending Refund; PAYMENT_RECONCILIATION → REFUND_PENDING |
| POST /bookings/:id/refund-completed | Refund boundary refund:manage | RefundCompletionDto | Refund | Trusted provider result and pending refund | Replay by key | Completes refund/payment state; REFUND_PENDING → REFUNDED |
| POST /bookings/:id/cancel | Customer booking:own or operational booking:operations | CancelBookingDto | BookingSummary | UUID; required key; 404 foreign; 409 invalid transition | Replay by key | Explicit `CancelBooking`; records reason, version/history/audit transactionally |

There is intentionally no `PATCH /bookings/:id/status`. Booking owns explicit transitions and financial snapshots. Pricing persistence/handoff, Dispatch candidate discovery and the Phase 9 payment/cash backend are implemented; a real external gateway adapter and object storage remain future dependencies.

## Payments, cash and settlements — Engineering Phases 9–10

Phase 6 Booking payment commands remain supported. Phase 9 adds a provider abstraction, attempts, verified webhooks, payment/refund history and settlement commands. The local validated provider is `mock`; no gateway credential is accepted from a request.

| Method/path | Authentication / role | Request DTO | Response | Validation / error cases | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `POST /payments` | Customer `payment:own` or admin `payment:manage` | `{bookingId}` | Payment + Attempt + checkout reference | Customer ownership; `PRICE_CONFIRMED`/`PAYMENT_PENDING`; server amount/currency; 404 foreign, 409 invalid/already confirmed | Required key; same actor/operation/hash replays | Creates/reuses ONLINE Payment and PaymentAttempt, transitions Booking to `PAYMENT_PENDING`, calls provider abstraction, audits |
| `GET /payments/:id` | Owning customer; finance/admin; scoped cash provider | None | Payment with attempts, status history, transactions, verified events, refunds and cash collection | Foreign customer/provider record is 404; no secrets | Read-only | None |
| `POST /payments/:id/retry` | Owning customer or `payment:manage` | None | Payment + new Attempt | ONLINE/FAILED payment and `PAYMENT_PENDING` Booking required | Required key | New attempt; Payment `FAILED` → `PENDING` |
| `POST /webhooks/payments/:provider` | Public provider callback | Signed raw JSON and `x-payment-signature` | `{accepted,duplicate,paymentId,eventId,type}` | Invalid signature 401; unknown reference, amount/currency/state mismatch or replay mismatch 409 | Unique `(provider,eventId)` plus raw payload hash | Verified event, PaymentAttempt/Payment history and transaction; Booking confirms only after verified success |
| `POST /payments/:id/refunds` | `refund:manage` or `payment:manage` | `PaymentRefundDto {amount,reason}` | Refund | Reconciled Payment; amount cannot exceed successful + pending remainder; 409 otherwise | Required key | Refund + history; server-side online provider refund; Payment/Booking updates on success |
| Existing `POST /bookings/:id/select-cash` | Customer `booking:own` | None | BookingSummary | `PRICE_CONFIRMED` only; selection is not receipt | Existing Booking key | CASH Payment intent and `CASH_SELECTED` Booking |
| Existing `POST /assignments/:id/collect-cash` | Scoped `cash:team`, finance or operations | `CashCollectionDto {amount}` | CashCollection | Completed assignment; exact historical amount; duplicate 409 | Existing Booking key | CashCollection with collector user/company/team, transaction, history and audit |
| Existing `POST /bookings/:id/reconcile-payment` | `payment:manage` or operations | None | BookingDetail | Confirmed/collected Payment; cash requires collection | Existing Booking key | Payment `RECONCILED`, reconciliation timestamp/history/audit |
| `GET /settlements` | Admin finance or own-company `settlement:company` | None | Scoped settlement summaries | Backend company scope; customers 403 | Read-only | None |
| `GET /settlements/:id` | Admin `settlement:manage` | UUID path | Full finance/allocations/reconciliation/history detail | Provider managers, dispatchers and customers 403; missing 404 | Read-only | None |
| `POST /settlements` | `settlement:manage` | `{companyId,periodStart,periodEnd}` | CALCULATED Settlement | Valid period; completed/refunded bookings with reconciled/refunded payments; 409 no eligible or duplicate allocation | Required key | Locked calculation, ProviderPayable snapshot, SettlementItem and immutable Payment allocations with history/audit |
| `POST /settlements/:id/calculate` | `settlement:manage` | None | CALCULATED Settlement | DRAFT only; 409 if not calculable/no eligible | Required key | Same locked calculation as create |
| `POST /settlements/:id/submit-review` | `settlement:manage` | None | READY_FOR_REVIEW Settlement | CALCULATED only | Required key | CALCULATED → READY_FOR_REVIEW with history/audit |
| `POST /settlements/:id/approve` | `settlement:manage` | None | APPROVED Settlement | CALCULATED or READY_FOR_REVIEW only; old direct-approve caller remains supported | Required key | Explicit approval with version/history/audit |
| `POST /settlements/:id/payments` | `settlement:manage` | `{amount,direction,reference,paidAt?,reason?}` | SettlementPayment + settlement status | Direction must match signed total; amount cannot exceed remaining; reference unique | Required key | APPROVED → PARTIALLY_PAID/PAID with history/audit |
| `POST /settlements/:id/reconcile` | `settlement:manage` | None | SettlementReconciliation `{status,difference,details,...}` | PAID/RECONCILED only; records MATCHED or DISCREPANCY without silent correction | Required key | Compares Booking payable snapshot, Payment/allocation, refund, cash and payout; MATCHED PAID → RECONCILED |
| `POST /settlements/:id/close` | `settlement:manage` | None | CLOSED Settlement | RECONCILED only | Required key | RECONCILED → CLOSED with history/audit |
| `POST /settlements/:id/cancel` | `settlement:manage` | `{reason?}` | CANCELLED Settlement | Pre-payout states only | Required key | Explicit cancellation; records remain immutable |
| `POST /settlements/:id/reverse` | `settlement:manage` | `{reason}` | REVERSED Settlement | PAID/RECONCILED/CLOSED only | Required key | Explicit reversal; never deletes allocations or payout history |

All money fields are server-checked strings with at most two fractional digits against JOD `DECIMAL(12,2)`. Webhooks are provider-verified after signature validation; Flutter never submits a success status. Shared envelopes, request IDs, DTO rejection and sanitized errors apply.

## Notifications + Location — Engineering Phase 11

Address coordinates may be omitted on create/update; the server resolves them through the configured `GeocodingProvider` and stores validation/geocoding metadata. If supplied, latitude must be `[-90,90]`, longitude `[-180,180]`, and both must be present together. `isDefault` is customer-owned and serialized by a customer row lock plus a partial unique database index. Booking address/location snapshots remain immutable and are the only historical source used by Dispatch.

| Method/path | Auth / role | Request DTO | Response | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| `POST /customers/me/addresses/validate` | Customer `address:own` | `{label,addressText,latitude?,longitude?,isDefault?}` | Validated address preview with coordinates/source | Ownership is from session; incomplete/invalid coordinates return `ADDRESS_COORDINATES_INCOMPLETE`/`ADDRESS_COORDINATES_INVALID` | Read/preview; no key | Geocoder call only; no persistence |
| `POST /customers/me/addresses` | Customer `address:own` | Same address DTO | Address with `isDefault`, `validationStatus` and coordinates | Own customer only; first active address becomes default; foreign fields rejected | No key; concurrent defaults serialize | Creates/re-geocodes address; clears prior default in the same transaction |
| `PUT /customers/me/addresses/:id` | Customer `address:own` | Same address DTO | Address projection | Foreign/archived address is 404; coordinate validation as above | No key | Updates only the owner’s address; historical Booking snapshots are unchanged |
| `DELETE /customers/me/addresses/:id` | Customer `address:own` | None | `{archived:true}` | Foreign/missing is 404 | No key | Archives address and promotes the next active address if the default was removed |
| `PUT /provider/teams/:id/location` | Own-team cleaner, company manager, or admin through current team scope | `{latitude,longitude,reportedAt}` | Team location/timestamp | Coordinate range; future timestamps invalid; stale values remain stored only as the latest report | No key | Row-locked update; Dispatch uses it only while within `DISPATCH_LOCATION_MAX_AGE_MINUTES` |
| `GET /notifications` | Authenticated user with `notification:own` | `limit?,offset?` | Own notification summaries | Always filters `userId` from the session; no cross-user/provider scope parameter | Read-only | None |
| `PATCH /notifications/:id/read` | Authenticated owner | `{reason?}` | `{id,readAt}` | Foreign notification is 404 | Repeat converges to the existing read timestamp | Sets read state only |
| `POST /devices` | Authenticated user with `notification:own` | `{token,platform:ios|android|web}` | Device registration | Token already owned by another user is `DEVICE_TOKEN_OWNED_BY_OTHER_USER` | Repeat token registration converges | Reactivates/updates the owner’s token |
| `DELETE /devices/:id` | Authenticated owner | None | `{inactive:true}` | Foreign/missing is 404 | Repeat after removal is 404 | Invalidates the token and prevents future delivery |

Notification records are created by the outbox consumer from authoritative Booking, Dispatch, Payment/Cash/Refund and Settlement events. The delivery worker creates append-only attempt history, retries transient failures with backoff, marks permanent failures, and deactivates invalid tokens. Push payloads never determine business state. There is no public reverse-geocoding endpoint because the current architecture does not require it; the provider abstraction supports it for future operational use.

## Provider assignments — Engineering Phase 13B

These endpoints are dedicated provider projections. Authentication is required and the active persisted grants must yield at least one assignment scope. `COMPANY_MANAGER` requires `assignment:company` and is filtered to the grant's active company. `TEAM_LEADER_CLEANER` requires `assignment:team` and is filtered to the exact active company/team pair. Customers, dispatchers and Home Clean admins do not gain provider access from their other permissions. Missing and out-of-scope assignment IDs both return 404.

`ProviderAssignmentListDto`: optional `limit` integer 1–100 (default 100), `offset` integer 0–1,000,000 (default 0), assignment `status=OFFERED|ACCEPTED|REJECTED|EXPIRED|CANCELLED|COMPLETED`, or `view=PENDING|ACTIVE|HISTORY`. `status` and `view` cannot be combined (`400 PROVIDER_ASSIGNMENT_FILTER_INVALID`). `PENDING` means unexpired offered rows; `ACTIVE` means accepted assignments; `HISTORY` means rejected/expired/cancelled/completed plus a server-expired offered row. An expired database offer is projected as `EXPIRED` and is not actionable.

`ProviderAssignmentSummary`: `id`, `bookingId`, `bookingNumber`, projected assignment `status`, `bookingStatus`, `startsAt`, `endsAt`, `assignedAt`, `expiresAt`, nullable `acceptedAt`/`rejectionReason`, `company{id,name,status}`, `team{id,name,status,active}`, `service{name,nameAr,durationMinutes}`, `location{addressText}`, server-derived action flags `canAccept`, `canReject`, `canMarkOnTheWay`, `canStartCleaning`, `canCompleteCleaning`, `canMarkTeamNoShow`, `canMarkCustomerNoShow`, and nullable role-authorized `cash`.

`ProviderAssignmentDetail` adds `location{label,addressText,latitude,longitude}`, immutable `property{type,size,rooms,bathrooms}`, `extras[{name,quantity}]`, nullable `instructions`, append-only `completionProofs[{id,storageKey,mimeType,byteSize,createdAt}]`, and `canSubmitCompletionProof`. It does not expose customer identity, price, commission, settlement data, dispatch candidates/scores, audit data or another provider.

`ProviderCashProjection`: `expectedAmount`, `currency`, `collectionState=EXPECTED|COLLECTED|RECONCILED`, `canCollect`. It is returned only when the actor has `cash:team` and the assigned Booking has a server-owned CASH Payment. Phase 13C Flutter presents collection only when `canCollect` is true and still relies on the mutation command to revalidate every condition under lock.

| Method/path | Authentication / role | Request DTO | Response | Validation / errors | Side effects |
|---|---|---|---|---|---|
| `GET /provider/assignments` | Scoped Manager `assignment:company` or Cleaner `assignment:team` | `ProviderAssignmentListDto` query | `ProviderAssignmentSummary[]` | 403 without provider assignment scope; 400 invalid/mixed filter | None |
| `GET /provider/assignments/:id` | Same | UUID path | `ProviderAssignmentDetail` | 404 missing/foreign company/team assignment | None |
| `GET /provider/cash-worklist` | Cleaner with `cash:team` and assignment team scope | `limit`, `offset`, optional `state=EXPECTED|COLLECTED|RECONCILED` | Cash-bearing `ProviderAssignmentSummary[]` for accepted/completed assignments | Manager/non-cash role 403; exact team isolation; invalid query 400 | None |

The existing `POST /assignments/:id/accept` and `/reject` remain the mutation contract. Both require a valid `Idempotency-Key`, revalidate assignment scope and `OFFERED` state under Booking/Assignment locks, and return 409 for stale state. Accept additionally revalidates expiry, active company/team, team `AVAILABLE` status and service capability. Reject now also returns `409 ASSIGNMENT_EXPIRED` after offer expiry. Same-key duplicates replay; concurrent different-key accept/reject produces one committed outcome and one conflict.

## Provider job execution — Engineering Phase 13C

Phase 13C uses the existing Booking-owned commands; there is no provider-specific lifecycle. All commands require authentication and a valid `Idempotency-Key`. A `COMPANY_MANAGER` is restricted to assignments in the active company grant through `assignment:company`; a `TEAM_LEADER_CLEANER` is restricted to the exact active company/team grant through `assignment:team`. Cash additionally requires `cash:team`, which the current seed grants only to the cleaner role. Missing and out-of-scope assignment IDs both return 404; non-provider identities receive 403.

| Method/path | Authentication / role and scope | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects and notifications |
|---|---|---|---|---|---|---|
| `POST /assignments/:id/on-the-way` | Manager own company, Cleaner exact team, or platform operations | None | `BookingSummary` | Assignment `ACCEPTED`; Booking `TEAM_ACCEPTED`; 404 foreign, 409 stale/invalid state | Same actor/operation/key replays; different-key races serialize | Booking `TEAM_ON_THE_WAY`, version/history/audit, AssignmentEvent, one `BOOKING_STATUS_CHANGED` outbox event |
| `POST /assignments/:id/start-cleaning` | Same | None | `BookingSummary` | Assignment `ACCEPTED`; Booking `TEAM_ON_THE_WAY`; company active; team active and not offline/paused; service capability retained; `TEAM_NOT_OPERATIONAL`/`TEAM_CAPABILITY_MISMATCH`/409 otherwise | Same as above | Booking `CLEANING_STARTED`, version/history/audit, AssignmentEvent, one authoritative outbox event |
| `POST /assignments/:id/complete-cleaning` | Same | None | `{id,status:COMPLETED}` Assignment projection | Assignment `ACCEPTED`; Booking `CLEANING_STARTED`; 409 stale/duplicate different key | Same as above | Assignment `COMPLETED`; Booking `CLEANING_COMPLETED`; histories/audit and one authoritative outbox event |
| `POST /assignments/:id/completion-proof` | Same | `CompletionProofDto {storageKey,mimeType,byteSize}` | `CompletionProof` | Completed assignment and Booking in `CLEANING_COMPLETED`, `PAYMENT_RECONCILIATION`, or `COMPLETED`; bounded metadata; 409 otherwise | Same key replays the exact proof; different key appends another immutable proof record | Append-only proof metadata and audit. No object upload and no notification; storage remains external |
| `POST /assignments/:id/collect-cash` | Cleaner exact team with `cash:team`, or finance/platform operations | `CashCollectionDto {amount}` | `CashCollection` | Completed assignment; Booking `CLEANING_COMPLETED`/`PAYMENT_RECONCILIATION`; CASH Payment in collectible state; exact server amount; 404 foreign, `CASH_COLLECTION_NOT_ALLOWED`/`CASH_PAYMENT_NOT_COLLECTABLE` 409 | Same key replays; payment lock, unique collection/payment relation and status checks make concurrent/different-key collection single-winner | Attributed CashCollection, PaymentTransaction/history, Payment `CASH_COLLECTED`, audit, `CASH_COLLECTED` outbox; starts Booking reconciliation when needed |
| `POST /assignments/:id/team-no-show` | Manager own company, Cleaner exact team, or platform operations | None | `BookingSummary` | Assignment `ACCEPTED`; Booking `TEAM_ON_THE_WAY`; 409 otherwise | Same key replays; concurrent outcomes serialize | Assignment `CANCELLED`; Booking `TEAM_NO_SHOW`; event/history/audit/outbox. Existing Dispatch retry policy remains separate |
| `POST /assignments/:id/customer-no-show` | Same | None | `BookingSummary` | Assignment `ACCEPTED`; Booking `CLEANING_STARTED`; 409 otherwise | Same key replays; concurrent outcomes serialize | Assignment `CANCELLED`; Booking terminal `CUSTOMER_NO_SHOW`; event/history/audit/outbox |

Provider completion is intentionally two-stage. The provider records operational completion; optional historical proof metadata does not gate completion. Only the existing finance/payment boundary may reconcile Payment and move `PAYMENT_RECONCILIATION → COMPLETED`. The Flutter app never treats a local tap, timeout, or notification as authoritative: it retains the command key after transport failure and reloads `GET /provider/assignments/:id` after every result/retry.

## Dispatch — Engineering Phase 8 complete scoped backend

All write routes below require a 1–128-character `Idempotency-Key` and `dispatch:manage` permission. They are Booking-owned commands; clients cannot submit scores, status, price or financial fields. Booking must be assignable under its existing state machine. Provider offer reads derive company/team scope from current database role grants, not request parameters.

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| POST /dispatch/bookings/:id/offer | Dispatcher/admin dispatch:manage | None | OperationalBooking | 409 active unexpired offer, invalid state/slot or team capacity; 404 missing booking | Required key; replay/mismatch check | Ranks eligible teams; expires a prior timed-out offer or retries after rejection; writes Assignment/Event, DispatchAttempt, Booking history and audit atomically; no candidate yields NO_TEAM_AVAILABLE |
| POST /dispatch/bookings/:id/manual | Dispatcher/admin dispatch:manage | ManualDispatchDto | OperationalBooking | 409 target ineligible/capacity, `DISPATCH_TERMINAL_NO_TEAM_AVAILABLE`, or `DISPATCH_ACCEPTED_JOB_REASSIGNMENT_UNSUPPORTED`; 404 missing booking | Required key; replay/mismatch check | Reasoned manual offer or pending-offer reassignment; optional scoped availability/area override; full history/audit in the same transaction |
| GET /dispatch/offers | Scoped company manager or cleaner with assignment permission | None | ProviderOffer[] | 403 no provider assignment scope | Read-only | At most 100 current unexpired offers, ordered by expiry; only own company/team; includes safe target company/team identity; no price, customer identity, commission or score |
| GET /dispatch/monitoring | Dispatcher/admin dispatch:manage | None | Operational counts and latest 100 attempts | 403 without permission | Read-only | No mutation |

`ManualDispatchDto`: `companyId` and `teamId` UUID v4, required nonblank reason 1–500 characters, optional boolean `overrideAvailabilityAndArea`. `LegacyManualAssignmentDto` adds explicit `startsAt`, `endsAt`, and `expiresAt` ISO instants; slot must match Booking and expiry must be future. Override never bypasses company/team active state, service capability, capacity or the historical Booking slot. Automatic decisions use server-configured weights and record factors/eligibility/selected team in DispatchAttempt and audit. OperationalBooking contains id/bookingNumber/status/slot and assignment id/companyId/teamId/status/offer timestamps only; it omits price, payments and customer identity. ProviderOffer includes assignment and booking IDs, `companyId`, `teamId`, `company{id,name}`, `team{id,name}`, offer/slot times, booking number, service name/duration, address/location and instructions only. The provider still acts through existing `/assignments/:id/accept` and `/reject` commands.

Offer expiry/retry occurs on the explicit route and in a PostgreSQL-polling DispatchWorker (ten-second interval outside test mode). Separate-process convergence, termination/recovery, restart deduplication, sustained timer retry and fault recovery passed local live validation. Offered/no-team decisions create durable outbox events, but no notification delivery is claimed. The master Booking graph keeps `NO_TEAM_AVAILABLE` terminal and has no direct accepted/started reassignment edge; both manual routes return explicit 409 conflicts for these states. Scoped Phase 8 acceptance is recorded in [phase8-dispatch.md](phase8-dispatch.md).

## Pricing — Engineering Phase 7 backend

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| POST /bookings/quote | Customer booking:own | QuoteRequestDto | Durable customer-facing quote | 404 inactive/foreign/archived source; 409 promotion unavailable | Optional Idempotency-Key; supplied keys replay/mismatch-check | Immutable PricingQuote + audit; no booking/payment or promotion use created |
| GET /bookings/quotes/:id | Customer booking:own | None | Stored quote, including historical expired/consumed quotes | 404 missing/foreign | Read-only | None |
| GET /admin/pricing/rules | pricing:manage | ListQueryDto | Rule records ordered by name/version | Bounded pagination | Read-only | None |
| POST /admin/pricing/rules | pricing:manage | PublishRuleDto | Published rule | 400 invalid definition/window; 409 non-increasing version | Required key; replay | Immutable new rule version + audit |
| POST /admin/pricing/rules/:id/activation | pricing:manage | {active:boolean} | Rule record (200) | 404 missing; stored definition validated on activation | Required key; replay | Activation only + audit |
| GET /admin/promotions | promotion:manage | ListQueryDto | Promotion records ordered by code | Bounded pagination | Read-only | None |
| POST /admin/promotions | promotion:manage | PublishPromotionDto | Promotion record | 400 invalid window/amount; 409 duplicate code | Required key; replay | Immutable terms with zero uses + audit |
| POST /admin/promotions/:id/activation | promotion:manage | {active:boolean} | Promotion record (200) | 404 missing | Required key; replay | Activation only + audit |

Quotes return `quoteId`, `pricingVersion`, `basePrice`, `extrasTotal`, extra line items, `adjustments[]`, `fees[]`, `discount`, `total`, `currency`, optional promotion projection, `createdAt`, `expiresAt` and verified inputs. Money is decimal text. Rule line responses include name/version/amount, never provider commission. Durable snapshots remain unchanged across catalog/rule edits.

`PublishRuleDto`: name `[A-Z][A-Z0-9_-]{0,79}`, positive 32-bit version, nested definition, boolean active, timezone-bearing startsAt and optional endsAt. `definition`: kind ADJUSTMENT/FEE, basis FIXED/PER_SIZE/PER_ROOM/PER_BATHROOM/PER_MINUTE/PERCENT_SUBTOTAL, decimal amount (max 10 integer/2 fractional digits), optional serviceId/propertyType/minSize/maxSize. Signed adjustments are allowed; fees nonnegative. Unknown fields are rejected.

`PublishPromotionDto`: code `[A-Z0-9_-]{1,40}`, nonnegative decimal discount/minTotal with schema precision, optional positive 32-bit maxUses, boolean active, timezone-bearing startsAt/endsAt. Both publication APIs validate end > start. Rule terms/promotion terms cannot be edited or deleted; publish a higher rule version/new promotion code.

One fixed-amount promotion applies after rules/fees. It is capped at subtotal, must meet active window/minimum, and increments uses only at successful booking creation. Quote TTL is five minutes (or earlier promotion end); supplied issuance keys replay the same expiry. For handoff, repeat quote inputs and promotion code in `POST /bookings` with quoteId. Existing callers without quoteId still use current rule evaluation. A consumed booking retains its price beyond quote expiry.

Pricing errors include `PRICING_RULE_INVALID`, `PRICING_WINDOW_INVALID`, `PRICING_AMOUNT_OUT_OF_RANGE` (400), and `PRICING_VERSION_NOT_INCREASING`, `PROMOTION_UNAVAILABLE`, `QUOTE_INPUT_MISMATCH`, `QUOTE_ALREADY_USED`, `QUOTE_EXPIRED`, `IDEMPOTENCY_KEY_REUSED` (409). All mutation keys use the same 1–128-character format as Booking. Full policy and validation: [phase7-pricing.md](phase7-pricing.md).

## Services

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /services | Public | None | PublicService[] | Common errors | Read-only | Active catalog only |
| GET /services/:id | Public | None | PublicService | UUID; 404 inactive/missing | Read-only | None |
| GET /admin/services | Admin; service:manage | None | ServiceRecord[] | Guard | Read-only | Includes inactive drafts |
| POST /admin/services | Admin; service:manage | ServiceDto | ServiceRecord | DTO; 409 duplicate code | Not deduplicated | Service + SERVICE_CREATED audit atomically |
| PUT /admin/services/:id | Admin; service:manage | ServiceDto | ServiceRecord | DTO/UUID; 404 missing; 409 code conflict | State converges; repeated audit | Service + SERVICE_UPDATED audit atomically |
| POST /admin/services/:id/extras | Admin; service:manage | ServiceExtraDto | Extra | DTO/UUID; 400 absent service FK; 409 duplicate service/code | Not deduplicated | Extra + SERVICE_EXTRA_CREATED audit atomically |

## Companies and teams

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /admin/companies | Admin; company:manage | None | CompanyRecord[] | Guard | Read-only | None |
| POST /admin/companies | Admin; company:manage | CompanyDto | CompanyRecord | DTO; 409 duplicate code | Not deduplicated | Company + COMPANY_CREATED audit atomically |
| PUT /admin/companies/:id | Admin; company:manage | CompanyDto | CompanyRecord | DTO/UUID; 404 missing; 409 code conflict | State converges; repeated audit | Company + COMPANY_UPDATED audit atomically |
| POST /admin/companies/:id/service-areas | Admin; company:manage | ServiceAreaDto | Area | DTO/UUID; 400 nonpositive radius or absent company FK | Not deduplicated | Area + SERVICE_AREA_CREATED audit atomically |
| GET /provider/teams | Admin team:manage, Dispatcher team:read, Manager team:company, or Cleaner job:team | None | TeamSummary[] | 403 without permitted scope | Read-only | Filters manager company / cleaner company+team; admin/dispatcher may list all |
| GET /provider/teams/:id | Admin team:manage, Dispatcher team:read, scoped Manager or exact-team Cleaner job:team | UUID path | ProviderTeamDetail: TeamSummary + company safe summary, nullable stored location/time, updatedAt | 403 without team scope; 404 missing/foreign company/team | Read-only | No side effects; no commission/customer/dispatch data |
| GET /provider/teams/:id/members | Admin, Dispatcher team:read, scoped Manager or Cleaner job:team | None | Member[] | UUID; 404 missing/unmanageable team | Read-only | Active members with active users only |
| POST /provider/teams | Admin team:manage or scoped Manager | TeamDto | CreatedTeam | DTO; 403 foreign company; 400 absent FK; 409 duplicate code | Not deduplicated | Team + TEAM_CREATED audit atomically; starts OFFLINE |
| POST /provider/teams/:id/availability | Admin team:manage, scoped Manager or own-team Cleaner job:team | AvailabilityDto | Availability | DTO/UUID; 404 missing/unmanageable; 400 invalid interval | Not deduplicated | Creates interval + TEAM_AVAILABILITY_CREATED audit atomically |
| PUT /provider/teams/:id/capabilities | Admin team:manage or scoped Manager | CapabilitiesDto | {serviceIds[]} | DTO/UUID; 404 missing/unmanageable; 400 absent service FK | Set converges | Locks team, replaces capabilities + TEAM_CAPABILITIES_REPLACED audit atomically; failure restores prior set |
| PUT /provider/teams/:id/availability-status | Admin team:manage, scoped Manager or own-team Cleaner job:team | TeamStatusDto | {id,status} | DTO/UUID; 404 missing/unmanageable | State converges | Locks team, changes operational status + TEAM_AVAILABILITY_STATUS_CHANGED audit atomically |

Cleaners can read their own team/members/schedule/capabilities and manage their own availability/status. Team metadata and capability changes remain manager/admin operations. Dispatchers have operational read access only. This operational team status route does not implement an arbitrary booking-status route. The Phase 8 initial eligibility policy treats any overlapping unavailable interval as a veto and requires one positive interval covering the full Booking slot; broader schedule conflict policy remains open.

## Provider team and settlement visibility — Engineering Phase 13D

All endpoints require the normal bearer session. `ProviderTeamDetail` contains `id`, `companyId`, `internalCode`, `name`, `status`, `capacity`, `active`, `company{id,name,status}`, nullable `latitude`, `longitude`, `locationAt`, and `updatedAt`. It intentionally reflects the already-stored last location and does not provide live tracking.

`ProviderSettlementSummary` contains `id`, `companyId`, `reference`, `status`, period, authoritative `total`, currency, version/timestamps, `company{id,name,status}`, authoritative `paidAmount`, payout direction, completed-work item count and nullable latest reconciliation status/time. `ProviderSettlementDetail` adds work items containing only item amount + booking ID/number/scheduled time/service names, payout records, and the latest reconciliation run/status/difference/time.

Provider settlement projections never return commission rate, platform commission, calculation snapshots, allocations or customer Payment objects, reconciliation detail JSON, history/audit, customer identity/address, or dispatch scoring. Values are serialized from PostgreSQL Decimal state; clients must not recompute them.

| Method/path | Authentication / role | Scope | Request DTO | Response DTO | Validation / errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|---|
| `GET /provider/settlements` | `COMPANY_MANAGER` with `settlement:company` | Active company IDs from the same authenticated grants | `ListQueryDto` query | `ProviderSettlementSummary[]` | 400 invalid pagination; cleaners/customers/admins/dispatchers 403 | Not applicable; read-only | None |
| `GET /provider/settlements/:id` | Same | Same; foreign company indistinguishable from missing | UUID path | `ProviderSettlementDetail` | Invalid UUID 400; foreign/missing 404; other roles 403 | Not applicable; read-only | None |

Team write APIs above retain their existing transaction locks and audit side effects. The new team detail and provider settlement reads create no audit/history/outbox/notification records. There are no Phase 13D payout, reconciliation or settlement-status mutations.

## Identity administration

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /admin/users | Admin; identity:read or identity:manage | AdminUserQueryDto | UserSummary[] | Guard/query filters | Read-only | None |
| POST /admin/users | Admin; identity:manage | ProvisionUserDto | ProvisionedUser | DTO; 400 VALIDATION_ROLE_SCOPE; 404 missing role/team match; 400 missing company FK; concurrent identical provisioning serialized by phone and user locks | Concurrent/sequential retries reuse identity/grant; repeated audit; no replay contract | Atomic user upsert, role grant, customer/team membership as needed, IDENTITY_PROVISIONED audit |
| PUT /admin/users/:id/status | Admin; identity:manage | UserStatusDto | {id,status} | DTO/UUID; 404 missing | State converges; repeated audit | Atomic status change, session revocation for non-ACTIVE status, USER_STATUS_CHANGED audit |

Provisioning an existing phone does not overwrite the existing user's name. Existing team membership is reactivated. Role listing/revocation is implemented below. No admin bootstrap HTTP route exists. These APIs are not a substitute for a complete reviewed identity-management workflow.


## Phase 5 additional contracts — 2026-09-19

Shared errors, HTTP envelopes and authentication rules above apply to every row. All route IDs are UUIDs. Lists marked ListQueryDto accept the bounded pagination described above. Privileged writes include actor, request ID and projected before/after values in the same transaction. Service/extra/company/area updates lock the changed row; team configuration changes lock the team. Deactivation retains historical records; catalog values are not a quote/pricing engine.

Additional DTOs:

| DTO / response | Fields |
|---|---|
| ListQueryDto | optional limit: integer 1–100, default 100; optional offset: integer 0–1000000, default 0 |
| AdminCompanyQueryDto | ListQueryDto plus optional status: PENDING/ACTIVE/SUSPENDED/INACTIVE and query: trimmed 1–120 character name/internal-code search |
| AdminTeamQueryDto | ListQueryDto plus optional companyId: UUID, status: AVAILABLE/BUSY/OFFLINE/PAUSED, active: boolean, and query: trimmed 1–120 character name/internal-code search |
| TeamUpdateDto | name: 1–120 characters; capacity: integer 1–100; active: boolean. Company/internal code cannot be changed through this route |
| CompanyProfileDto | name: 1–160 characters only; no status/commission changes |
| CustomerSummary | id (customer ID), name (nullable), phone, locale, status |
| ProviderCompany | id, name, status; no commission/internal code |
| RoleGrant | id (grant ID), role, companyId (nullable), teamId (nullable) |

| Method/path | Authentication / role | Request DTO | Response | Validation / additional errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|
| GET /admin/customers | Admin customer:read | AdminCustomerQueryDto | AdminCustomerSummary[] | Bounded status/locale/phone-prefix-or-name filters; pagination | Read-only | None |
| GET /admin/customers/:id | Admin customer:read | UUID path | AdminCustomerDetail | 404 missing customer | Read-only; addresses/properties excluded | None |
| GET /admin/services/:id/extras | Admin service:manage | ListQueryDto | Extra[] | 404 missing parent | Read-only | Includes inactive extras |
| PUT /admin/services/:id/extras/:extraId | Admin service:manage | ServiceExtraDto | Extra | 404 missing/wrong parent; 409 duplicate code | State converges; repeated audit | Update/deactivate extra + SERVICE_EXTRA_UPDATED audit |
| GET /admin/companies/:id/service-areas | Admin company:manage | ListQueryDto | Area[] | 404 missing parent | Read-only | Includes inactive areas |
| PUT /admin/companies/:id/service-areas/:areaId | Admin company:manage | ServiceAreaDto | Area | 404 missing/wrong parent; 400 nonpositive radius | State converges; repeated audit | Update/deactivate area + SERVICE_AREA_UPDATED audit |
| GET /provider/companies | Scoped Manager company:own, Admin company:manage, Dispatcher company:read | ListQueryDto | ProviderCompany[] | 403 no scope | Read-only | Manager sees own companies; admin/dispatcher see operational projection across companies |
| PUT /provider/companies/:id/profile | Scoped Manager company:own or Admin company:manage | CompanyProfileDto | ProviderCompany | 404 missing/foreign/unmanageable | State converges; repeated audit | Name only + COMPANY_PROFILE_UPDATED audit |
| GET /provider/companies/:id/service-areas | Same read scope as provider company list | ListQueryDto | Area[] | 404 missing/foreign company | Read-only | No commission data |
| PUT /provider/teams/:id | Scoped Manager team:company or Admin team:manage | TeamUpdateDto | TeamSummary | 404 missing/unmanageable | State converges; repeated audit | Name/capacity/activation + TEAM_UPDATED audit; inactive team loses cleaner scope on subsequent requests |
| GET /provider/teams/:id/availability | Admin, Dispatcher team:read, scoped Manager or own-team Cleaner job:team | ListQueryDto | Availability[] | 403 no scope; 404 foreign/missing team | Read-only | Ordered by startsAt then id |
| PUT /provider/teams/:id/availability/:availabilityId | Admin team:manage, scoped Manager or own-team Cleaner job:team | AvailabilityDto | Availability | 400 invalid interval; 404 foreign/missing team or interval | State converges; repeated audit | Update interval + TEAM_AVAILABILITY_UPDATED audit |
| DELETE /provider/teams/:id/availability/:availabilityId | Same as availability write | None | {removed:true} | 404 foreign/missing team or interval; retry after removal returns 404 | No replay | Removes schedule configuration + TEAM_AVAILABILITY_REMOVED audit; no assignment/history deletion |
| GET /provider/teams/:id/capabilities | Same as availability read | None | {serviceIds[]} | 403 no scope; 404 foreign/missing team | Read-only | Complete capability set |
| GET /admin/users/:id/roles | Admin identity:read or identity:manage | UUID path | RoleGrant[] | 404 missing user | Read-only | Complete grant set, no internal role tables/permissions |
| DELETE /admin/users/:id/roles/:grantId | Admin identity:manage | None | {revoked:true} | 404 missing/wrong user/grant; retry returns 404 | No replay | Removes grant, deactivates matching cleaner membership, revokes all user sessions + IDENTITY_ROLE_REVOKED audit atomically |

Provider membership creation/reactivation stays behind admin identity provisioning. Company managers cannot create identities or elevate roles. Suspending/deactivating a user revokes sessions; reactivation does not revive tokens. Company/team inactivity removes provider scopes on subsequent authenticated requests. Existing in-flight authorized requests are not cancelled. No historical booking/snapshot data is changed by these commands.
# Phase 15 Batch 2 endpoint changes

Base path: `/api/v1`. All error responses use the existing sanitized API error envelope. OTP request and verification responses have `Cache-Control: no-store`. Provider callbacks are public routes but cryptographically verified.

| Method | Path | Authentication / role | Request DTO and validation | Response DTO | Errors | Idempotency | Side effects |
|---|---|---|---|---|---|---|---|
| POST | `/auth/provider/request-otp` | Public; phone must belong to an active Provider identity | `{phone}` in E.164 | `{challengeId,expiresAt}` | 400 invalid phone, 401 unavailable identity, 429 server limit, 503 delivery failure | Request is rate limited; repeated requests can send again | Persists expiring audience-bound challenge; sends local/Twilio Verify OTP |
| POST | `/auth/provider/verify-otp` | Public; Provider challenge only | `{challengeId}` UUID v4, `{code}` six digits | Access/refresh tokens and expiries | 400 invalid DTO, 401 invalid/expired/used code, 429 server limit, 503 provider failure | Challenge is single use under row lock | Creates session for existing Provider user |
| POST | `/auth/admin/request-otp` | Public; phone must belong to active Admin identity | `{phone}` in E.164 | `{challengeId,expiresAt}` | 400, 401, 429, 503 as above | Request is rate limited | Persists expiring Admin challenge; sends OTP |
| POST | `/auth/admin/verify-otp` | Public; unscoped Home Clean Admin grant required | `{challengeId}` UUID v4, `{code}` six digits | Access/refresh tokens and expiries | 400, 401, 429, 503 as above | Challenge is single use under row lock | Creates Admin session; Admin BFF still checks `/auth/me` before setting cookies |
| POST | `/tracking/assignments/:id/location` | Bearer; assigned team member with `assignment:team` | UUID assignment ID; `TeamLocationDto {latitude,longitude}` finite numbers in geographic bounds | `{accepted:boolean,arrived:boolean}` | 400 invalid coordinates, 403 unless accepted assignment and Booking is `TEAM_ON_THE_WAY`, 404 missing/out-of-scope assignment | No client key; latest point replaces the team's operational point; only the first geofence hit records arrival | Updates team location/time and may append one `GPS_ARRIVED {targetArrival,actualArrival,delaySeconds}` event; never changes Booking state |
| GET | `/tracking/bookings/:id` | Bearer; owning Customer only | UUID booking ID; no body/query | `{active,location,etaSeconds,etaStale?,etaUnavailable?}`; eligible location is `{latitude,longitude,updatedAt,stale}` | 400 invalid UUID; 404 missing/foreign booking; pre-on-the-way returns `active:false`; route errors return unavailable ETA | Read only; no key | No write. Returns only newest accepted assignment during `TEAM_ON_THE_WAY`; hides team points older than that assignment/on-the-way activation boundary |
| POST | `/webhooks/payments/tap` | Public Tap callback; required `hashstring` header | Raw Tap charge JSON with charge object/status, JOD amount, created time, gateway/payment signature fields, local `reference.transaction` attempt ID and `reference.order` booking number | `{accepted,duplicate,paymentId,eventId,type}` | 401 invalid signature or malformed payload; 409 unknown charge, attempt mismatch, booking mismatch, replay mismatch or invalid payment state; verified amount/currency mismatch returns `accepted:false` | Provider/event ID unique; exact replay returns the stored result; different bytes for the same ID are rejected | Backend-only payment/attempt/booking transition, transaction/history/audit/outbox; callback/redirect never gives client authority |

The existing `POST /auth/request-otp` and `/auth/verify-otp` remain Customer-only. Existing `POST /payments`, `/payments/:id/retry`, and `/payments/:id/refunds` keep the same request/response contracts and authorization, but select the configured mock or Tap provider. Tap checkout references come from the backend; client return URLs are never payment confirmation. Refund initiation requires an idempotency key and finance permission. Tap refund lifecycle remains incomplete as described in the [Batch 2 report](phase15-batch2-external-services-report.md).

`POST /bookings/:id/complete` still requires Bearer authentication, `payment:manage` or `booking:operations`, a UUID booking ID, an `Idempotency-Key`, `PAYMENT_RECONCILIATION`, and a reconciled authoritative payment. It returns the existing `BookingSummary`, replays the same-key response, and appends Booking history/audit/outbox through the existing transaction. A completion proof is no longer required. The legacy completion-proof metadata endpoint remains optional and does not represent an upload or public object.

Object-storage classes add no public HTTP route in Batch 2. The secure local adapter and expiring-access capability are internal boundaries only; exposing upload/download before chat-message or complaint-attachment ownership exists would bypass reference authorization.
