# Engineering Phase 11 — Notifications + Location

Updated 2026-09-21. **Complete for the scoped backend acceptance.** Flutter UI, deployment and external maps/push integrations remain out of scope.

## Existing functionality found

Before Phase 11, the repository already had `Address` with required coordinates and customer composite ownership, `CompanyServiceArea` center/radius records, `Team.latitude/longitude/locationAt`, immutable Booking address/location snapshots, and initial `Notification`, `NotificationDelivery`, `DeviceToken` and `OutboxEvent` tables. Core address CRUD and Dispatch’s Haversine/area/freshness policy existed. No Location/Notification application services, delivery provider, consumer or worker existed.

## Implemented

- Added `LocationModule` and `LocationService` for customer-owned address validation, deterministic credential-free geocoding, reverse-geocoding provider abstraction, default-address promotion and concurrent default protection. Address history remains safe because Booking snapshots are unchanged and immutable.
- Added explicit team location reporting with coordinate/timestamp validation, provider/team scope checks and row locking. Existing Dispatch eligibility/scoring is unchanged: fresh team location contributes distance/ETA, while stale data falls back to a covered service-area center.
- Added `NotificationModule` with own-user notification reads/read state, device registration/invalidation, multiple devices, `MockPushNotificationProvider`, outbox consumption, event-key idempotency, push delivery retries/backoff, append-only delivery attempts and invalid-token cleanup.
- Added authoritative outbox emissions for Booking creation/status transitions, assignment offers/no-team decisions, Payment status changes, cash collection, refund creation and Settlement status changes. Notification payloads are projections only and cannot change business state.

## Database/migration

Additive `0007_phase11_notifications_location` was added; `0001`–`0006` were not rewritten. It adds address default/geocode metadata and a partial active-default index; notification category/references/event key/delivered timestamp; delivery token/retry/error fields; token invalidation/last-seen fields; `DeliveryStatus.SENDING`; and append-only `NotificationDeliveryAttempt` with supporting indexes/foreign keys. Configured public PostgreSQL migration checksum: `33ae1674370b28eb1c2de6ae7392d697693e73e0d10da69c7c6f7f0965eaf781`.

## API changes

Added/changed endpoints are documented in [api.md](api.md): customer address validation/default-aware CRUD, provider team location reporting, notification list/read, and device-token register/invalidate. Address coordinates are optional only at the API boundary; the server always persists validated coordinates before a Booking can consume the address.

## Reliability/security decisions

Notification creation is keyed by outbox event and recipient, so replayed event/webhook processing does not duplicate history. Delivery claims use `SENDING`, then record `SENT`, retryable `PENDING`, or terminal `FAILED`; provider-invalid tokens are deactivated. Customers can only reach their own addresses/notifications/devices. Provider operational location is exposed through scoped Dispatch offers only; internal candidate scores and finance data remain excluded. Team location is latest-point storage, not continuous personal tracking.

## Validation

- Prisma schema validation and client generation: PASS.
- Backend build: PASS.
- Phase 11 focused unit tests: **3/3**; expanded unit suite: **40/40**.
- Phase 11 compiled live PostgreSQL acceptance: **1/1**, covering geocoding, invalid coordinates, ownership/default concurrency, notification dedupe/read state, delivery success, transient retry/backoff, invalid-token cleanup and customer isolation.
- PostgreSQL migration `0007` applied and inspected; Redis direct PING: PASS (`PONG`).
- Existing Dispatch unit/policy and regression coverage remains passing; stale-location area fallback is covered by the new unit test. No Dispatch scoring or state-machine behavior was replaced.
- Standard `npm.cmd test`/`test:database` wrappers remain environment-sensitive before assertions because Prisma/Node child processes may fail with `spawn EPERM` or attempt the blocked engine-download proxy. The compiled direct validation path is the accepted local fallback.

## Known limitations

The geocoder and push provider are deterministic/mock; no external map credentials, route ETA, FCM/APNs/Web Push credentials, delivery SLA or production queue soak is claimed. Reverse geocoding is provider-capable but not exposed because the current architecture does not require a public endpoint. Notification preferences were not added because the current architecture has no preference model or client contract; all implemented notifications are transactional/operational. Flutter screens remain untouched.

## Status

Phase 11 is **COMPLETE for the scoped backend acceptance**. Exact next phase: **Engineering Phase 12 — Customer Application**. Do not start it automatically.
