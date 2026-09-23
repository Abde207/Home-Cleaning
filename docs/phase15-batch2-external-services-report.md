# Phase 15 Batch 2 — External Services Report

Date: 2026-09-23
Status: **implementation complete to the current provider-decision boundary; production launch remains blocked**.

No production credential, real OTP, charge, refund, push, customer/provider data access, deployment, schema change, or migration was used. Maps and object-storage vendors remain unapproved, so production startup deliberately fails closed.

## 1. Completed

### 15C — Twilio Verify

- `OtpProvider` separates local/test delivery from Twilio Verify v2.
- Customer, Provider, and Admin challenges use separate endpoints and audience-bound challenge hashes. Provider and Admin identities must already have their allowed roles.
- Twilio credentials are environment-only. Staging/production reject file delivery.
- Send/check calls have eight-second timeouts and one bounded retry for transport, HTTP 429, or provider 5xx failures. `Retry-After` is bounded before use.
- Local limits remain: three requests per phone per 15 minutes, 20 per IP per 15 minutes, 60 verification attempts per IP per 15 minutes, five checks per challenge, five-minute expiry, and one-time use.
- Provider responses are mapped to sanitized error codes. OTPs, phone numbers, credentials, and response bodies are not logged.

### 15D — Tap Payments

- The Tap adapter creates JOD hosted-checkout charges using stable attempt IDs in `reference.transaction` and `reference.idempotent`, plus the authoritative booking number in `reference.order`.
- Charge responses must match JOD, amount, idempotency reference, Tap charge shape, and an HTTPS checkout URL.
- Tap `hashstring` verification covers the documented charge fields with timing-safe comparison. The backend then verifies charge ID, amount, currency, attempt reference, booking reference, booking/payment state, and provider/event uniqueness.
- Exact duplicate webhooks return the recorded result; a reused event ID with different bytes is rejected. Forged, wrong-amount, wrong-currency, wrong-attempt, wrong-booking, and unknown-charge callbacks cannot confirm a payment.
- Provider calls have ten-second timeouts and one bounded retry for transport, 429, and 5xx responses. Charge/refund retries reuse the same provider idempotency reference.
- Refund requests remain finance-authorized, bounded by the server-owned refundable balance, and accept local success only from a matching Tap `REFUNDED` response.
- Customer Flutter opens only an absolute HTTPS checkout URL outside the app and refreshes backend state after resume. Client navigation or return URLs never confirm payment.

### 15E — Push notifications

- `PushNotificationProvider` supports the local fake and FCM HTTP v1. iOS delivery is explicitly through Firebase's APNs bridge.
- OAuth credentials remain server-only. Push payloads are size-bounded, string-only, reject reserved keys, and contain event labels/IDs rather than addresses or financial details.
- FCM `UNREGISTERED` and token-specific `INVALID_ARGUMENT` responses invalidate the device token. Authentication/configuration failures stop that delivery without retiring a valid token. Retryable 429/5xx responses remain in the durable backoff flow and honor bounded `Retry-After`.
- Existing notification history, outbox materialization, delivery leases, stale-claim recovery, five-attempt cap, token ownership, unregister flow, 60-day stale-token cleanup, and event-key deduplication remain intact.
- Delivery IDs are used as Android and APNs collapse identifiers to bound visible duplicates. PostgreSQL remains authoritative.

### 15F — Maps and location boundary

- Geocoding and routing are injected provider interfaces selected by configuration. The deterministic geocoder and unavailable-route adapter are local/test implementations only.
- Customer address coordinates are validated, saved, copied into immutable booking snapshots, and used by existing service-area dispatch eligibility.
- Team location updates require the exact accepted team scope and `TEAM_ON_THE_WAY`. Coordinates cannot change booking state.
- Customer reads require booking ownership and return only the newest accepted assignment's team. A reassigned team's pre-assignment coordinate is hidden, preventing disclosure of either the previous team or an old location from the new team.
- Responses retain the last location/update time, mark location and ETA staleness, and explicitly report unavailable ETA. The Customer app now displays these values and the stale warning.
- Configurable geofence arrival records one `GPS_ARRIVED` event with target arrival, actual arrival, and nonnegative delay. It does not transition booking state.

### 15G — Object-storage boundary

- `PrivateObjectStore` supports generated opaque keys, owner-reference checks, MIME magic-byte checks, a 10 MiB bound, private reads, and safe idempotent deletion hooks.
- Complaint objects accept PNG/JPEG only; chat objects accept PNG/JPEG/PDF. User filenames never form object keys.
- `PrivateObjectAccess` issues HMAC-authenticated read capabilities for at most 15 minutes, rejects the wrong owner, tampering, malformed claims, unsafe keys, and expired access.
- Completion proof is no longer required for final booking completion. Existing historical/optional proof metadata was retained without introducing a completion-photo requirement or migration.

## 2. Partially completed

- **Tap recovery:** the adapter safely retries within Tap's documented idempotency window, but charge/refund HTTP calls still occur inside database transactions. A provider success followed by local rollback needs a durable reconciliation job before live money traffic. Pending refund callbacks are not implemented.
- **Push clients:** backend delivery is implemented. Native Firebase project files, runtime permission/token acquisition, token refresh, and real-device Android/iOS validation require the actual Firebase/Apple projects. Current app token-source boundaries remain inactive without that configuration.
- **Location publishing:** backend authorization, storage, geofence, customer read, and Customer display are implemented. Provider Flutter does not publish device GPS yet because native location permission/background policy and a production maps/location decision are outstanding.
- **Storage domain integration:** secure local primitives are implemented. Upload/finalize/download APIs cannot validate chat-message or complaint-attachment ownership until those domain records and authorization rules exist.

## 3. Not implemented

- A production maps/geocoding/routing adapter or map-rendering SDK.
- A production object-storage adapter, bucket/container policy, malware scanner, or chat/complaint attachment API.
- Chat presence and “no push while inside chat”; no chat domain exists in the current repository.
- Durable Tap charge/refund reconciliation, signed asynchronous refund handling, or operator replay tooling.
- Native Firebase/APNs setup or real mobile device push validation.
- Provider Flutter GPS capture/background publishing.

## 4. Provider decisions still pending

- Maps/geocoding/routing vendor, Jordan coverage, retention terms, API/key restrictions, quota, billing, and road-ETA launch policy.
- Object-storage vendor, region, private bucket/container, identity model, encryption, signed-access TTL, retention/deletion, scanning, backup, and audit policy.
- Native mobile background-location and anti-spoofing policy.
- Chat and complaint attachment domain/API ownership rules.

Production rejects `MAPS_PROVIDER=mock` and `STORAGE_PROVIDER=local`; no fallback is permitted.

## 5. Credentials required

- Twilio: Account SID, Auth Token, Verify Service SID, approved Verify service policy and spend/fraud controls.
- Tap: separate test/live secret keys, registered HTTPS webhook URL, HTTPS redirect URL, merchant/account approval.
- Firebase/APNs: project ID, service-account email/private key delivered through a secret manager, registered Android/iOS applications, APNs key/certificate configured in Firebase, signed iOS entitlement/profile.
- Future maps: approved server/client keys or workload identity after vendor selection.
- Future storage: approved workload identity or scoped storage credentials after vendor selection.

No credential value belongs in Git, Dart defines, logs, error bodies, screenshots, or this report.

## 6. Environment variables

| Area | Variables |
|---|---|
| Profile | `NODE_ENV`, `APP_ENVIRONMENT`, `HOST`, `PORT`, `CORS_ORIGINS` |
| Data services | `DATABASE_URL`, `REDIS_URL` |
| OTP | `OTP_HASH_SECRET`, `OTP_DELIVERY_MODE`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| Payments | `PAYMENT_PROVIDER`, local-only `PAYMENT_WEBHOOK_SECRET`, `TAP_SECRET_KEY`, `TAP_WEBHOOK_URL`, `TAP_REDIRECT_URL` |
| Push | `PUSH_PROVIDER`, `IOS_PUSH_TRANSPORT`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` |
| Location/storage | `MAPS_PROVIDER`, `STORAGE_PROVIDER`, `ARRIVAL_GEOFENCE_METERS`, `TRACKING_STALE_SECONDS` |
| Workers | `DISPATCH_WORKER_ENABLED`, `NOTIFICATION_WORKER_ENABLED` |

`.env.example` contains placeholders only. Development/test may use file/mock/local adapters. Staging requires explicit selections and may use sandbox credentials. Production requires Twilio, Tap live, and FCM/APNs, then still fails closed until maps and storage providers are approved and implemented.

## 7. Security considerations

- The backend remains the source of booking, payment, dispatch, location visibility, notification history, and access decisions.
- Webhooks use the raw request body, timing-safe verification, server-owned financial values/references, unique event IDs, payload hashes, row locks, audit/history, and outbox side effects.
- Customer tracking uses ownership and assignment state; provider writes use exact company/team scope. Reassignment resets the visibility time boundary.
- Push tokens are never returned in notification/admin projections. Provider error bodies, credentials, OTPs, object bytes, and tokens are not logged.
- Local objects use generated keys, private filesystem permissions, content-byte validation, owner binding, signed expiry, and safe deletion paths. There is no public object URL.
- The push send/DB-commit crash window can still produce a visible duplicate; collapse IDs and leases bound behavior but cannot guarantee exactly-once external delivery.

## 8. Tests run and results

Results recorded during this continuation:

- Backend build: **PASS**; complete unit suite: **PASS, 57/57**.
- Prisma schema validation through the installed-engine helper: **PASS**. No schema/migration changed.
- Customer Flutter analyze: **PASS**; tests: **PASS, 59/59**; Android debug APK: **PASS**.
- Provider Flutter analyze: **PASS**; tests: **PASS, 74/74**; Android debug APK: **PASS**.
- Admin typecheck: **PASS**; tests: **PASS, 16/16**; production build: **PASS**.
- Compose configuration: **PASS**.
- Secret scan: **PASS, 596 files checked**, with no high-confidence credential/private-file match.
- `git diff --check`: **PASS** after removing one report-line whitespace issue; line-ending notices are repository/Windows conversion warnings.
- Full backend regression, focused live payment/booking suites, and database-integrity assertions: **BLOCKED before assertions** because `127.0.0.1:55432` was not listening (`ECONNREFUSED`). Docker Desktop was installed but its Linux engine did not become available, so Compose could not start PostgreSQL/Redis.

## 9. Known limitations

- No production provider credential or sandbox account was available, so adapter behavior is validated with fakes only.
- Tap's 24-hour idempotency does not replace durable reconciliation after an ambiguous result.
- FCM/APNs collapse identifiers are best effort, not exactly-once delivery.
- Road ETA is unavailable until a routing provider is selected; the UI explicitly says so and marks stale data.
- Secure object primitives are not an authorization substitute for missing chat/complaint domain references.
- iOS builds and real-device provider behavior cannot be validated on this Windows host.

## 10. Next steps

1. Approve maps and object-storage vendors and their security/retention policies.
2. Implement durable Tap initiation/refund reconciliation and sandbox certification before enabling live money traffic.
3. Configure Firebase/APNs projects, add native token acquisition to both apps, and validate delivery/token rotation on real devices.
4. Approve Provider background-location policy, then add device GPS publishing and real road routing/ETA.
5. Define chat and complaint attachment records/authorization, then expose storage upload/finalize/download APIs against the approved provider.
6. Re-run live database, full backend, Android debug, Admin, Prisma, database-integrity, and secret-scan gates with local dependencies available.
