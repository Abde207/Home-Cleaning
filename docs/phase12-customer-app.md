# Engineering Phase 12E — Customer App Finalization + Integration Validation

Updated 2026-09-21. **Complete for scoped acceptance.** This phase stabilized and validated the existing 12A–12D customer application; it did not add a new product surface or change backend contracts.

## Scope and validation performed

- Traced authentication → home → services/extras → property/address → schedule → server quote → review → cash/online payment intent → confirmation → authoritative booking detail/status → history → notifications → cancellation and exposed payment/refund states.
- Audited every customer endpoint used by Flutter against [api.md](api.md): method/path, auth scope, DTO fields, response projection, shared errors and idempotency. No contract mismatch or backend change was required.
- Hardened secure session restoration, logout cleanup, refresh serialization, stale response suppression after logout, screen-specific loading/error state, pagination parsing, notification read deduplication, address reloads, quote invalidation and command retry keys.
- Added customer-safe error copy for network, timeout, 401, 403, 404, 409, validation, rate-limit, configuration and malformed-response cases. Raw backend messages are not shown.
- Confirmed Arabic RTL and English LTR navigation, forms, booking timeline, status/payment labels, notifications, addresses, profile and date/price rendering. Removed the unused payments placeholder route and obsolete unused text-field widget.

## Security, command safety and known limitations

Tokens remain in `flutter_secure_storage`; no credentials, OTPs or payment data are logged. Concurrent refresh requests share one refresh operation. Logout clears session, in-memory customer/booking state and device registration cleanup remains best effort when offline. Booking creation, confirmation, cash selection, online initiation/retry and cancellation retain stable in-memory idempotency keys and double-submit guards; address and notification operations converge through authoritative reload/read semantics.

The real payment gateway/provider, external geocoder, production FCM/APNs credentials, customer-safe team location/ETA API and customer rating API remain unavailable. Device registration awaits a genuine platform token. No authenticated Flutter-to-live-backend production session was run, and iOS was not built on Windows. These are integration limitations, not simulated app behavior.

## Test and build results

- `flutter pub get`: PASS.
- `flutter analyze`: PASS, no issues.
- `flutter test`: **56/56 PASS**.
- Android debug build with `API_BASE_URL=http://10.0.2.2:3000/api/v1`: PASS; APK at `mobile/customer_flutter/build/app/outputs/flutter-apk/app-debug.apk`.
- Backend TypeScript build: PASS.
- Direct backend regression was not claimed from the ordinary `npm test` invocation: it ran against the public schema and produced environment/state-dependent failures (17/21 test files passed). The repository’s documented isolated compiled runner remains the valid path for database regression; no backend source was changed in 12E.

## Remaining customer-app gaps

No customer-safe live team tracking/ETA, rating/review, real online checkout, production push registration, live production session validation or Windows iOS build is available. The requested time is future validated by Booking; slot availability is resolved later by Dispatch because no customer availability endpoint exists.

**Phase 12A–12E is complete for scoped customer-app acceptance. Exact next phase: Provider App. It was not started automatically.**

---

# Engineering Phase 12D — Customer Booking Tracking + Notifications

Updated 2026-09-21. Defined from the existing Phase 12C app and Phase 8/11 backend contracts, then implemented for customer scope. No backend API, authorization rule, schema or provider was changed.

## Exact scope and existing customer contract

| Capability | Existing customer API | Implemented behavior |
|---|---|---|
| Booking list/history | `GET /bookings?limit=100&offset=…` with `booking:own` | Fetches supported pages and groups locally into upcoming, active, completed, cancelled and other terminal outcomes. No server status filter. |
| Booking status and assignment | `GET /bookings/:id` with `booking:own` | Uses the exact Booking status, ordered `history[].newStatus`, latest `assignments[].status`, and schedule. Displays only status, never company/team IDs, member identity, events, proofs, scores or coordinates. |
| Cancellation | `POST /bookings/:id/cancel` with `booking:own` | Retains the Phase 12C command and reloads detail. The server decides whether the transition is allowed. |
| Payment and refunds | `GET /bookings/:id` nested `payments[].status` and `payments[].refunds[]`; `GET /payments/:id` also exists for an owning customer | Displays server statuses and refund amounts from booking detail. No Flutter refund calculation or success mutation. Refund creation routes require operational scopes and are not offered to customers. |
| Notification center | `GET /notifications?limit=100&offset=…`, `PATCH /notifications/:id/read` with `notification:own` | Own-user history, read/unread, refresh, loading/empty/error/offline/retry, bilingual titles/status, and booking navigation when the outbox payload contains a `bookingId`. Notifications do not change booking state. |
| Device tokens | `POST /devices`, `DELETE /devices/:id` with `notification:own` | Client repository and registration state accept only a real platform token, persist the returned registration ID securely, handle rotation and attempt invalidation before logout. No token is fabricated. |

The backend Booking enum actually exposed through `GET /bookings` and `GET /bookings/:id` is `REQUESTED`, `PRICE_CONFIRMED`, `PAYMENT_PENDING`, `CASH_SELECTED`, `PAYMENT_CONFIRMED`, `SEARCHING_FOR_TEAM`, `TEAM_ASSIGNED`, `TEAM_ACCEPTED`, `TEAM_ON_THE_WAY`, `CLEANING_STARTED`, `CLEANING_COMPLETED`, `PAYMENT_RECONCILIATION`, `COMPLETED`, `CANCELLED`, `NO_TEAM_AVAILABLE`, `REJECTED`, `TEAM_NO_SHOW`, `CUSTOMER_NO_SHOW`, `REFUND_PENDING`, `REFUNDED`. The UI translates these exact states and shows actual history entries, rather than a predicted progress sequence. Payment, refund and assignment labels follow their existing backend enums.

## Screens and refresh

- Booking details now shows the authoritative status timeline, assignment status, payment status and each backend refund amount/status. `TEAM_ON_THE_WAY` states that live location and arrival time are unavailable. The existing cancellation/payment retry commands remain server owned.
- My bookings is linked from Home and groups the complete customer list by backend state and schedule. It provides pull and button refresh, empty/error/retry states and detail navigation. Home's upcoming summary remains a quick link.
- Notifications refreshes on entry, pull, and app resume; shows read/unread, marks owned items read, and opens a referenced booking when `payload.payload.bookingId` exists. The Home unread badge loads notification history. Unknown event types retain their server title in English; known Booking/Payment/Refund event classes and states have Arabic/English copy.
- Booking detail, Home and history refresh on app resume. Explicit refresh is available. There is no background polling or local business-state promotion. In-flight customer/booking reads cannot repopulate cleared session state after logout/expiry.

## Missing customer-facing capabilities and limitations

- `GET /bookings/:id` contains assignment IDs, status and operational metadata, but no customer-safe team name/member projection. The UI presents only assignment status. `/dispatch/offers` and `PUT /provider/teams/:id/location` are provider/operations scoped, not customer APIs.
- No customer-safe live team location, location freshness, distance or ETA endpoint exists. Dispatch's internal straight-line ETA/area-center fallback is not a customer tracking contract. No map, coordinates or ETA is rendered. A future backend phase must define a safe projection, authorization and freshness semantics before Flutter can show these.
- The Prisma schema has `Rating`, but there is no customer rating/review HTTP route. No rating UI was invented.
- Device registration is contract-ready, but this project has no runtime FCM/APNs token source or credentials. The app therefore has no token to register automatically; `DeviceRegistrationController.tokenAvailable` is the integration point for a future real platform adapter. Logout cleanup is best effort when network access fails; the stored registration ID remains for recovery. No production push delivery or platform callback was validated on Windows.
- The notification list projection omits a top-level `bookingId`. Booking and refund outbox payloads can carry one; payment-only notifications with only a `paymentId` cannot deep-link directly to a booking through this list contract. Notifications remain non-authoritative.
- Payment provider and geocoder/push provider remain mocks. No iOS build or authenticated Flutter-to-live-backend session was run on Windows.

## Validation

- `flutter pub get`: PASS.
- `flutter analyze`: PASS, no issues.
- `flutter test`: **56/56 PASS** (38 previous plus 18 new tests covering status timeline, history grouping/paging/refresh, notification paging/read/deep link/localization/error, device lifecycle/ownership error, payment/refund/assignment display, unavailable location notice, and logout ordering).
- `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1`: PASS; debug APK generated.
- Existing isolated live Phase 11 backend acceptance rerun: **1/1 PASS** in a disposable local PostgreSQL schema, including notification/device ownership and location scope. Flutter repository/widget tests use deterministic transport/repositories; no live authenticated mobile session or production push/location test is claimed.

**Phase 12D was complete for its scoped customer-facing contracts. Phase 12E above is now complete for scoped acceptance. Exact next phase: Provider App.**

---

# Engineering Phase 12C — Customer Booking Experience

Updated 2026-09-21. Implemented and validated against the existing Booking, Pricing, customer address/property and Payment boundaries. No backend schema or API was changed.

## Customer workflow

The customer selects an active catalog service and supported extras, then selects or creates a saved property and a validated saved address. The booking screen accepts a future local date/time and sends its UTC instant to the Booking API. The quote screen requests a durable server quote, shows its base price, historical extra lines, adjustments, fees, discount, promotion, total, currency and expiry, then presents a review with cash or online choice. Changing a price input invalidates the quote. An expired quote requires a new issuance.

Confirmation is a sequence of backend commands: consume the quote with `POST /bookings` (`REQUESTED`), call `POST /bookings/:id/confirm` (`PRICE_CONFIRMED`), then select cash or initiate online payment. A booking is displayed as confirmed or paid only when a subsequent `GET /bookings/:id` reports that state. Cash selection is explicitly shown as uncollected. Online initiation reports pending; verified provider webhook state is read from the backend. The configured backend provider returns a `mock-payments.invalid` checkout URL, so the app does not open it or display a fabricated success state. Failed online payments can use the backend retry command.

The detail screen loads the customer's scoped booking projection: booking number, service/address/property snapshots, schedule, extras, total, payment method/status, booking status and assignment status. Home provides links to current and historical booking details. The UI shows the customer cancellation action only from backend transition graph states that admit `CANCELLED`; it calls the explicit cancellation command and reloads the authoritative detail. No company/team IDs, provider scores or internal finance data are displayed.

## Existing endpoints consumed

| Purpose | Endpoint |
|---|---|
| Catalog and service details | `GET /services`, `GET /services/:id` |
| Address selection and creation | `GET /customers/me/addresses`, `POST /customers/me/addresses/validate`, `POST /customers/me/addresses` |
| Property selection and creation | `GET /customers/me/properties`, `POST /customers/me/properties` |
| Price | `POST /bookings/quote` |
| Booking, confirmation and details | `POST /bookings`, `POST /bookings/:id/confirm`, `GET /bookings`, `GET /bookings/:id` |
| Payment method | `POST /bookings/:id/select-cash`, `POST /payments`, `POST /payments/:id/retry` |
| Cancellation | `POST /bookings/:id/cancel` |

`BookingRepositoryImpl` handles booking and payment API payloads. `BookingController` owns the draft, step, quote, operation keys, loading/errors and server detail. Typed booking models parse the backend projections; presentation widgets display the quote, localized status and detail. The shared API client continues to handle bearer sessions, one refresh, errors and request IDs. Terminal authentication failure clears the session and guarded routes return to sign in.

Every required Booking/Payment command uses a stable `Idempotency-Key` for retries of the same operation. The submit button is guarded during an in-flight request; a create timeout retains the key and draft for a same-key retry. Deterministic 400/404/409 errors release that draft for correction. Keys are held in memory for the active session; recovery after process termination is not yet durable.

Status labels cover the backend's Booking graph and Payment states in Arabic and English. Cancellation rules and prices are never calculated locally. Invalid inputs, unavailable resources, quote expiration, server conflicts, failed/pending payments, network/timeout and expired authentication are surfaced without changing backend status locally.

## Validation

- `flutter pub get`: PASS.
- `flutter analyze`: PASS, no issues.
- `flutter test`: **38/38 PASS** (14 earlier tests plus 24 booking/auth-error tests using mocked repositories/API transport).
- `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1`: PASS; `mobile/customer_flutter/build/app/outputs/flutter-apk/app-debug.apk` produced.
- The existing isolated backend live runner passed **14/14** assertions/suites across `booking.test.ts`, `pricing.test.ts` and `payments.test.ts` in a disposable local PostgreSQL schema with seed and compiled NestJS. It validates quote consumption, command idempotency, cash intent, online initiation/webhooks/retry and cancellation. The standard `npm.cmd test -- booking.test.ts pricing.test.ts payments.test.ts` wrapper stopped before assertions because Prisma attempted a blocked engine download; the documented `scripts/test-backend-direct.mjs` fallback passed.
- No authenticated Flutter-to-live-backend session was run; widget/repository tests use deterministic mocks and the backend contracts were checked separately with live acceptance tests.

## Backend gaps and remaining limits

- There is no customer slot availability endpoint. `POST /bookings/quote` has no schedule field and `POST /bookings` validates a future instant, not guaranteed team availability. The app warns that the requested time remains subject to backend validation and later dispatch.
- The existing payment adapter only returns an invalid mock checkout URL. An actual online checkout and verified success require a future provider adapter; the customer app stops at pending/retry/authoritative status reads.
- Historical booking extra snapshots expose a name but no Arabic name, so detail may show that server name in Arabic mode. Quote extras can use the active catalog's Arabic label by ID where present.
- In-flight idempotency keys are not persisted across app termination. iOS was not built on Windows. Interactive maps and continuous team location remain future work.

**Exact next sub-phase: Phase 12D. Its title/scope has not been specified in the repository; do not start it automatically.**

---

# Engineering Phase 12B — Customer Core Experience

Updated 2026-09-21. This section records the implemented Phase 12B customer slice. The Phase 12A foundation record remains below as historical context.

## Implemented screens and behavior

- Bootstrap/splash: restores the secure session, validates it through `GET /auth/me`, uses the existing refresh-on-401 transport behavior, and clears invalid sessions before routing to authentication.
- Authentication: phone entry, international-format validation, OTP request, six-digit verification, resend, loading/error states and logout using the existing OTP/session endpoints.
- Home: Home Clean branding, localized greeting/profile context, primary Book Cleaning entry point, service discovery, upcoming booking summary from `/bookings`, notifications entry and profile/address navigation.
- Services: backend service catalog list and service details with localized name selection, description, duration, base price/extras display, loading/error/empty/refresh states, and a deferred booking handoff. Prices are displayed only from backend responses.
- Addresses: list, add, edit, archive/delete, default-address handling and server validation/geocoding through the existing customer address APIs. No map selector was introduced.
- Profile: profile display/edit, backend-supported locale preference (`ar`/`en`), logout, address navigation and notifications navigation.
- Notifications: existing notification list/read APIs are presented as a customer surface with unread state and refresh/error/empty handling.

## API integrations

| Customer capability | Existing API consumed |
|---|---|
| OTP/session | `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Services | `GET /services`, `GET /services/:id` |
| Profile | `GET /customers/me`, `PATCH /customers/me` |
| Addresses | `GET/POST/PUT/DELETE /customers/me/addresses`, `POST /customers/me/addresses/validate` |
| Home booking summary | `GET /bookings` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |

The backend success/error envelope, bearer session, request IDs, refresh behavior and API error codes are handled by the Phase 12A `ApiClient`. No backend contract was changed. The catalog API does not expose categories, so no category endpoint was invented; the supported flat catalog is rendered directly.

## Flutter architecture changes

Added typed `customer_models`, `CustomerRepository`, `CustomerRemoteDataSource`, `CustomerRepositoryImpl` and `CustomerController`. Added presentation screens under `home`, `services`, `addresses`, `notifications`, `profile`, and a reusable localized `CustomerScaffold` with bottom navigation. The existing RouterDelegate now maps the real customer routes and retains deferred booking/payment placeholders. Profile locale state drives Material localization and RTL/LTR direction.

## Validation

- `flutter pub get`: passed.
- `flutter analyze`: passed with no issues.
- `flutter test`: passed **14/14**.
- Android debug build: passed with `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1`; APK generated at `mobile/customer_flutter/build/app/outputs/flutter-apk/app-debug.apk`.
- Arabic/English validation: localized strings cover all new screens, Material direction follows the selected locale, and profile locale persistence is covered by controller tests.

## Known limitations and next sub-phase

Full booking creation/quote/scheduling, production payment gateway UI, interactive map selection, device-token registration UI and Provider/Admin applications remain out of scope. No missing backend API prevented Phase 12B; the backend simply has no service-category endpoint and therefore the catalog remains flat.

**Exact next sub-phase: Phase 12C — Customer Booking Experience. It was not started automatically.**

---

# Engineering Phase 12A — Customer Flutter Foundation

Updated 2026-09-21. This record covers only the customer Flutter foundation. Phase 12B has not started.

## Repository-derived starting point

The repository contained a generated Flutter customer shell at `mobile/customer_flutter` with only `cupertino_icons`, `flutter_lints`, and a single `MaterialApp` placeholder. It had Android/iOS/web platform folders, no customer feature screens, no Dart tests, and no networking or session layer. The provider Flutter project was left untouched.

The backend source of truth is the NestJS API under `/api/v1`. The relevant customer contract is:

- JSON success envelope: `{success: true, data, meta.requestId}`.
- JSON failure envelope: `{success: false, error: {code, message}, meta.requestId}`.
- Public OTP: `POST /auth/request-otp`, `POST /auth/verify-otp`.
- Session lifecycle: `POST /auth/refresh`, authenticated `POST /auth/logout`, authenticated `GET /auth/me`.
- Customer surfaces prepared by the backend: `/services`, `/customers/me`, `/customers/me/addresses`, `/customers/me/properties`, `/bookings`, `/bookings/quote`, `/payments`, `/notifications`, and `/devices`.
- Booking/payment commands require server-owned state transitions and `Idempotency-Key`; the client never sets prices, payment success, assignment, settlement, or booking status directly.

No backend files, migrations, endpoints, credentials, or completed backend phase behavior were changed for this sub-phase.

## Concise Phase 12 plan

1. Establish a Flutter application boundary and dependency choices.
2. Add environment-driven configuration, API transport, structured errors, safe retry, auth headers, and idempotency support.
3. Add secure session persistence and the existing OTP/access-refresh/logout lifecycle.
4. Add application auth state and guarded route architecture for the remaining customer surfaces.
5. Add the bilingual RTL/LTR localization and reusable visual foundation.
6. Add focused foundation tests and run package, analyzer, test, and Android validation where supported.
7. Document limitations and leave full customer workflows to the next sub-phase.

## Implemented architecture

```text
lib/
├── application/       AuthController and application state
├── core/
│   ├── config/         --dart-define configuration
│   ├── errors/         structured AppException
│   ├── localization/   Arabic/English delegate and strings
│   ├── network/        authenticated ApiClient
│   ├── services/       request metadata service
│   ├── storage/        secure session storage contract/implementation
│   ├── theme/          colors, theme, spacing
│   └── widgets/        buttons, fields, cards, loading/error/empty states
├── data/
│   └── auth/           remote data source and repository implementation
├── domain/
│   ├── auth/           session and repository contracts
│   └── models/         reusable API model types
├── presentation/
│   ├── auth/           minimal OTP entry flow
│   ├── bootstrap/      bootstrap loading state
│   └── home/           foundation home shell
├── routing/            route enum, parser, guarded RouterDelegate
└── main.dart           dependency composition root
```

The structure keeps presentation, application/state, domain, data/API, models, repositories, services, routing, and shared/core concerns separate. The six feature routes beyond home are intentionally placeholders; no full booking, payment, maps, or notification UI was implemented.

## Dependency decisions

- `http 1.6.0`: small, stable transport layer with an injectable client for tests.
- `flutter_secure_storage 9.2.4`: access/refresh tokens are not stored in `SharedPreferences` or other plain preferences storage.
- `intl 0.20.3`: available for future locale-aware dates, numbers, and JOD presentation as customer feature screens are added.
- Flutter SDK `ChangeNotifier`: enough for the current authentication/bootstrap state; no established project state package existed, so Riverpod/Bloc complexity was not introduced in 12A.
- Flutter SDK Router APIs: route paths are centralized and testable without a navigation package.

Run-time API configuration is supplied without secrets or source changes:

```text
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

`API_BASE_URL` has no source-code default. The app can render the auth shell without it, but requests fail with a configuration error until the environment is supplied.

## Networking and authentication

`ApiClient` provides base URL resolution, JSON serialization, response-envelope unwrapping, request IDs, bearer headers, timeout handling, structured API errors, and injectable HTTP clients. GET requests may retry once after a transport failure; commands are not automatically retried. A 401 triggers one refresh attempt and then a single original-request retry. Command callers can provide `Idempotency-Key`, which is forwarded unchanged.

`AuthRepositoryImpl` follows the backend’s exact phone OTP and opaque rotating-session behavior. Successful OTP verification stores the returned access/refresh tokens and expiry timestamps securely. Refresh rotates the session, logout calls the backend before clearing local state, and failed/expired refresh clears the local session. `GET /auth/me` is used during bootstrap to validate a restored session.

## Routing and localization

Prepared route paths are `/`, `/auth`, `/home`, `/services`, `/addresses`, `/booking`, `/booking/details`, `/payments`, `/notifications`, and `/profile`. Authentication state gates the shell: bootstrap shows loading, unauthenticated users see OTP auth, and authenticated users can reach the home foundation and prepared routes.

Arabic and English are supported through a typed `LocalizationsDelegate`; `MaterialApp` resolves locale direction automatically, giving Arabic RTL and English LTR. Backend/domain values remain data/status codes; display text belongs to localized resources rather than enum translation guesses.

## Validation

- `flutter pub get`: passed; 37 packages changed/resolved.
- `flutter analyze`: passed with no issues.
- `flutter test`: passed **8/8**.
- `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1`: passed; generated `build/app/outputs/flutter-apk/app-debug.apk`.
- Foundation tests cover the API envelope/headers/refresh/error path, auth session serialization, OTP/auth/logout state, route parsing, Arabic/English localization basics, and secure-storage repository contract.
- iOS was not required because this validation is on Windows.

## Known limitations

- No production OTP, payment, map, push, or analytics credentials are connected.
- OTP UI is only the minimal foundation flow; phone validation, resend timers, accessibility polish, and full onboarding remain later work.
- Services, addresses, booking, booking tracking, payments, notifications, and profile routes are prepared placeholders, not feature implementations.
- No API repositories for those feature areas were added until their Phase 12 contracts are implemented screen-by-screen.
- No connectivity plugin or production offline queue was added. Transport errors are classified and surfaced, while safe GET retry is limited to one attempt.
- No iOS build was run on Windows.

## Exact next sub-phase

**Phase 12B — Customer Core Experience:** implement the first customer feature slice using the existing contracts, beginning with authenticated profile/address/service reads and the home/services/address experience. Booking UI, production payment UI, maps, and the rest of the customer surface remain sequenced after that slice.

Phase 12B was not started automatically.
