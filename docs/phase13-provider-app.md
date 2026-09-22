# Engineering Phase 13 — Provider Application

## Phase 13D — Provider Team Management + Financial Visibility — COMPLETE

Updated 2026-09-21. The repository-defined remaining Provider gaps are now closed with scoped team management and read-only, provider-safe settlement visibility. Phase 13A–13C authentication, assignments, job execution, cash, notification navigation and recovery were preserved. No Prisma schema change or migration was required.

### Implemented scope

- Company managers can list company teams, open team detail, create and update teams, activate/deactivate teams, change operational status, view active members, create/update/delete availability periods, and replace existing service capabilities.
- Team leaders/cleaners see only their exact active team and can use the existing own-team status and availability commands. They cannot create/edit team metadata or change capabilities.
- Team detail exposes only operational company/team fields plus the latest already-stored location and timestamp. It does not add live GPS or a location writer UI.
- Company managers can open a read-only settlement list/detail with authoritative payable total, paid total, direction, status, period, completed-work references, payout records and latest reconciliation status/difference. Flutter performs no financial calculation and provides no payout mutation.
- The prepared `/team` and `/financials` routes now use typed repositories and `ProviderManagementController`; dashboard financial navigation is visible only to an identity with `settlement:company`. Direct/deep-link access remains protected by backend authorization.

### Backend/API audit and changes

Existing team list, member, create/update, schedule, capability, status and location contracts were reused. One missing team read was added: `GET /provider/teams/:id`, using the existing company/exact-team policy and 404 convention. Its projection is team summary + `company{id,name,status}`, nullable latitude/longitude/location timestamp and updated timestamp.

Provider settlement detail previously existed only as an admin-grade object containing commission, allocation, calculation, reconciliation detail and audit history. Phase 13D adds dedicated `GET /provider/settlements` and `GET /provider/settlements/:id` read projections for `COMPANY_MANAGER` + `settlement:company`. Foreign settlement IDs are 404; cleaners, customers, dispatchers and admins receive 403 on these provider-only routes. Admins retain the legacy full `/settlements/:id`; provider managers now receive 403 there and use the narrow provider route, preventing commission/allocation/audit leakage.

Provider settlement reads accept existing `ListQueryDto` pagination (limit 1–100, offset 0–1,000,000), are non-idempotent read-only operations, and have no database, audit, history, notification or outbox side effects. Team writes retain their pre-existing row locks and audit transactions; no new mutation or concurrency model was introduced.

### Authorization and data minimization

- Manager scope is derived from the active company role grant. Cleaner scope requires the same active company and exact active team in one grant.
- Foreign team and settlement IDs return 404 on scoped provider reads. A customer receives 403. Admin/dispatcher team read permissions are unchanged; provider-finance routes do not implicitly grant them provider identity.
- Provider finance projections omit commission rate, platform commission, payable calculation snapshots, Payment/allocation internals, reconciliation details, history/audit, customer identity, address and internal dispatch fields.
- The client rechecks settlement company IDs against authenticated provider scopes as defense in depth; NestJS/database filtering remains authoritative.

### Validation

- Backend TypeScript build: PASS; unit suite: **40/40 PASS**.
- Focused clean-schema Phase 13D live acceptance: **1/1 PASS**.
- Clean-schema Booking/Dispatch/Payment/Settlement/Provider regression slice: **8/8 PASS**.
- Isolated Phase 11 notification/outbox regression: **1/1 PASS**. The broad shared-schema run passed 63/64; its sole failure was the known order-contaminated Phase 11 zero-outbox fixture, which passed in isolation.
- Provider Flutter: `flutter pub get` PASS; analyzer PASS; **73/73 tests PASS**; Android debug build PASS.
- Unchanged Customer Flutter regression: **56/56 PASS**.

Known limitations remain intentional: provider managers cannot provision identities/team memberships; settlement and payout operations remain platform/admin workflows; location is last-reported read-only in this UI; no production payment gateway, push, object storage, live GPS or deployment was added.

**Phase 13D and Provider Phase 13 are COMPLETE. Exact next phase: Phase 14 — Admin Dashboard. It was not started.**

---

## Phase 13C — Provider Job Execution — COMPLETE

Updated 2026-09-21. Phase 13C implements the provider operational lifecycle on the existing Booking/Assignment boundary. No parallel provider state machine and no database migration were added.

### Existing state machine decision

The repository already contained every required transition:

```text
Assignment ACCEPTED / Booking TEAM_ACCEPTED
→ TEAM_ON_THE_WAY
→ CLEANING_STARTED
→ Assignment COMPLETED / Booking CLEANING_COMPLETED
→ PAYMENT_RECONCILIATION
→ Booking COMPLETED
```

The existing exception paths remain `TEAM_ON_THE_WAY → TEAM_NO_SHOW → SEARCHING_FOR_TEAM` and `CLEANING_STARTED → CUSTOMER_NO_SHOW` (terminal). Provider completion records operational service completion; final Booking completion remains the existing proof- and payment-reconciliation-gated finance/operations command. There is no generic status patch.

### Backend behavior and provider projection

- Existing Booking-owned commands are used for on-the-way, start, operational completion, proof, cash collection, team no-show and customer no-show. Booking/Assignment row locks, actor-operation-key advisory idempotency, AssignmentEvent, BookingStatusHistory, AuditLog and outbox behavior are retained.
- Start work now revalidates the locked team/company operational state and current service capability. A busy team may start its accepted job; inactive/offline/paused teams and removed capabilities fail closed.
- `GET /provider/assignments` and detail add server-derived job action flags. Detail also exposes the assignment's append-only completion-proof metadata and proof capability, enabling recovery after restart or an uncertain command result.
- Company managers remain restricted to active grants for the assignment company. Team leaders/cleaners remain restricted to the exact active company/team pair. Foreign company/team IDs and arbitrary assignment IDs are indistinguishable 404s; non-provider identities are 403.
- Cash remains cleaner-only under the existing `cash:team` grant. Collection checks the exact authoritative Payment amount, locks the Payment, attributes collector user/company/team, records transaction/history/audit, moves Payment to `CASH_COLLECTED`, and produces the existing customer outbox event. Managers cannot see cash detail or call the provider cash path with their current seed permissions.
- Team/customer no-show actions expose only the already-supported transitions. No new no-show policy was invented.

### Completion proof and final completion

The existing proof contract supports immutable metadata only: `storageKey`, `mimeType`, `byteSize`, and server timestamp. The Provider app can submit a reference already stored by an approved external system and can recover previously recorded proof metadata. It does not pretend to upload photos/files. Production object-storage upload, signed references and media scanning remain future integration work.

Operational completion changes Assignment to `COMPLETED` and Booking to `CLEANING_COMPLETED`. A separate existing platform payment boundary reconciles Payment and completes Booking only when a proof exists. Flutter never marks either record complete locally.

### Provider Flutter workflow

- Assignment detail transitions into a dedicated active-job route after acceptance and can recover the same job from scoped server detail after restart/login/navigation.
- Server-supported actions are Mark on the way, Start work, Complete cleaning, submit completion-proof reference, exact-amount cash collection, team no-show and customer no-show.
- Every success refreshes `GET /provider/assignments/:id`. Notifications provide references only. Duplicate taps are blocked while a command is in flight.
- A transport timeout/network failure retains the same idempotency key. Retry uses that key and then reloads authoritative state; the app never infers failure from a timeout.
- Operational fields remain limited to service/extras/address/schedule/property/notes/payment requirement/team. Customer identity, dispatch scores, commission, settlement data and audit records are absent.
- English LTR and Arabic RTL strings cover execution, proof, cash and no-show flows.

### Validation

- Backend TypeScript build: PASS.
- Backend unit suite: **40/40 PASS**.
- Focused clean-schema Phase 13C live acceptance: **1/1 PASS**.
- Clean-schema Booking/Dispatch/Payment/Provider regression slice: **5/5 PASS**.
- Isolated clean-schema Phase 11 notification/outbox validation: **1/1 PASS**.
- Provider Flutter: `flutter pub get` PASS; analyzer PASS; **64/64 tests PASS**; Android debug build PASS.
- Concurrency validation: different-key start, completion, cash collection and no-show races each produced one success and one 409; same-key retries replayed. One Booking transition/history/outbox and one payment/proof mutation remained authoritative.
- Customer impact: no Customer Flutter source changed; **56/56 Customer Flutter tests pass**. Existing Booking/Dispatch/Payment lifecycle regressions pass, and customer notifications are created from authoritative state without duplicate outbox consumption.

No Prisma schema or migration change was required. Production object storage, payment gateway, FCM/APNs, live GPS, team management, provider financial/settlement management, Admin Dashboard and deployment remain out of scope.

**Phase 13C is COMPLETE. Exact next sub-phase: Phase 13D (title/scope is not defined in the current repository). It was not started.**

---

## Phase 13B — Provider Operational Dashboard + Assignment Inbox — COMPLETE

Updated 2026-09-21. Phase 13B implements the first backend-authoritative provider workflow: Dashboard → Assignment Inbox → Assignment Detail → scoped Accept/Reject → accepted/active recovery. Phase 13A remains documented below.

### Backend assignment projection

No schema change was required. Existing `Assignment.companyId` and `Assignment.teamId` remain the source of target identity, and existing Booking/Payment snapshots remain authoritative. A dedicated `ProviderAssignmentsModule` adds:

| Method/path | Auth and role | Scope | Response/behavior |
|---|---|---|---|
| `GET /provider/assignments` | Authenticated `COMPANY_MANAGER` with `assignment:company` or `TEAM_LEADER_CLEANER` with `assignment:team` | Manager: current active company; cleaner: current active company + exact team | Narrow list projection. Supports `limit`, `offset`, optional assignment `status`, or `view=PENDING|ACTIVE|HISTORY`. `status` and `view` are mutually exclusive. |
| `GET /provider/assignments/:id` | Same | Same; foreign or arbitrary IDs are 404 | Operational detail with booking number/state, immutable service/address/property snapshots, extras, schedule, instructions, target company/team and role-authorized cash projection. |
| `GET /provider/cash-worklist` | Authenticated cleaner with `cash:team` | Exact current company/team assignment scope | Accepted/completed cash assignments only. Optional `state=EXPECTED|COLLECTED|RECONCILED`; returns expected amount/currency and collection state. Managers do not have this permission and receive 403. |

The assignment projection omits customer identity, booking price, commission, settlements, dispatch scores/candidate audit and other providers. A database `OFFERED` row whose server-side expiry has passed is projected as `EXPIRED`; it is not actionable. Accepted assignments remain recoverable after restart/login/network failure because every list/detail load comes from PostgreSQL.

`GET /dispatch/offers` remains compatible and now adds `companyId`, `teamId`, `company{id,name}` and `team{id,name}`. Dispatch scoring, ranking, attempts, worker behavior, retry policy and concurrency were not redesigned.

### Authorization and actions

- Company managers retain company-wide assignment read/accept/reject through `assignment:company`.
- Team leaders/cleaners retain exact-team read/accept/reject through `assignment:team`.
- Only cleaners currently have `cash:team`; managers therefore receive no assignment cash fields and cannot access the cash worklist.
- Customers, dispatchers and Home Clean admins are not implicitly allowed into `/provider/*` assignment endpoints, even if they have other operational permissions.
- Foreign-company/team assignment IDs return 404. The accept/reject commands re-lock and re-check assignment scope/state; acceptance additionally revalidates expiry, company/team operational state and service capability.
- Accept/reject retain the existing actor/operation/idempotency-key store. Same-key duplicate commands replay; different-key concurrent accept/reject serializes to one success and one conflict. Rejecting an expired offer now returns `409 ASSIGNMENT_EXPIRED`, matching acceptance.

### Provider Flutter implementation

The Provider app now has typed assignment summaries/details, repository/data-source commands and a `ProviderOperationsController`; widgets contain no API calls. Implemented screens are:

- operational Dashboard with backend-loaded pending offers, accepted/active work, team status, recent notifications and cleaner-only cash alerts;
- Assignment Inbox with server-backed Pending, Accepted/Active and History filters;
- Assignment Detail with safe service, extras, schedule, address, property, target team/company, instructions and authorized cash state;
- accept confirmation and optional-reason reject UI with in-flight duplicate-tap protection and retained idempotency keys for transport-failed retries;
- accepted/active recovery through the same list/detail endpoints;
- team/company context read screen;
- own-user notifications with assignment-offer navigation. Notification status/payload is never trusted: navigation always loads `GET /provider/assignments/:id`.

English LTR and Arabic RTL labels cover assignment/booking/offer/cash states, rejection and operational errors. Raw backend enums are mapped through localization resources.

### Cash boundary

Phase 13B closes the read/projection gap but does not add a collection command or fake local cash list. `GET /provider/cash-worklist` and assignment `cash` fields read the existing Payment/CashCollection truth. The already-existing `POST /assignments/:id/collect-cash` is intentionally not exposed in Flutter in this phase; collection execution belongs to Phase 13C.

### Validation

- Backend TypeScript build: PASS.
- Backend unit suite: **40/40 PASS**.
- Clean-schema compiled live Booking/Dispatch/Payment/Provider slice: **5/5 PASS**.
- Focused Provider assignment acceptance: **1/1 PASS**; focused Dispatch regression: **1/1 PASS**; focused Payment/Cash regression: **1/1 PASS**.
- Full direct backend run: **61/62 PASS**. Its only failure is the pre-existing order-dependent Phase 11 fixture expecting zero outbox rows after earlier Dispatch tests created rows. Phase 11 rerun alone in a clean schema: **1/1 PASS**.
- `flutter pub get`: PASS.
- `flutter analyze`: PASS with no issues.
- Provider Flutter tests: **52/52 PASS**.
- Android debug build with `API_BASE_URL=http://10.0.2.2:3000/api/v1`: PASS; APK at `mobile/provider_flutter/build/app/outputs/flutter-apk/app-debug.apk`.

### Remaining boundary and next step

No migration was added. Job execution commands, on-the-way/start/complete UI, completion proof, actual cash collection, team management, provider financial dashboard, production push, live location and Admin work remain out of scope.

**Phase 13B is COMPLETE. Exact next sub-phase: Phase 13C — Provider Job Execution. It was not started.**

---

## Phase 13A — Provider Flutter Foundation

Updated 2026-09-21. **Phase 13A is complete for the scoped Provider Flutter foundation.** This checkpoint does not implement assignment acceptance/rejection, job execution, team management, cash collection, settlement workflows, production push, live location, or Phase 13B.

## Repository-derived starting point

`mobile/provider_flutter` already existed as a generated Android/iOS/web Flutter project. Its application code was one `MaterialApp` placeholder, its `pubspec.yaml` contained only the generated dependencies, its README was generated boilerplate, and it had no tests, networking, authentication, session storage, routing, localization, provider scope, repositories, or feature architecture. Useful platform scaffolding and identifiers were preserved.

The completed Customer app was used only as a consistency reference. Provider business state, models, controllers, repository contracts, routes, strings, theme, secure-storage key, client identifier, and presentation remain in `mobile/provider_flutter`; no customer source or shared dependency was changed.

## Architecture

```text
mobile/provider_flutter/lib/
├── application/auth/       bootstrap, authentication and provider-scope state
├── core/
│   ├── config/             environment-only API configuration
│   ├── errors/             structured failures and provider-safe display copy
│   ├── localization/       English/Arabic operational terminology
│   ├── logging/            metadata-only network event contract
│   ├── network/            API envelope, auth, retry, refresh and cancellation
│   ├── services/           request/idempotency metadata
│   ├── storage/            secure session storage abstraction and adapter
│   ├── theme/              provider visual tokens and spacing
│   └── widgets/            buttons, cards, badges, loading/error/empty states,
│                         confirmation dialogs and bottom sheets
├── data/
│   ├── auth/               existing auth API data source/repository
│   └── provider/           scoped provider API data source/repository
├── domain/
│   ├── auth/               session and authentication contracts
│   └── provider/           identity/scope/company/team/offer/notification/
│                         settlement models and repository contract
├── presentation/           bootstrap, OTP, access denied, dashboard, profile,
│                         shared provider navigation and prepared placeholders
├── routing/                guarded RouterDelegate and provider route map
└── main.dart               dependency composition root
```

Flutter SDK `ChangeNotifier` and Router APIs remain the state/routing approach, matching the established Customer foundation without coupling provider state to customer state. No additional state or navigation framework was introduced.

## Authentication and provider scope

The Provider app uses the existing phone OTP/session endpoints: `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/refresh`, authenticated `POST /auth/logout`, and authenticated `GET /auth/me`. Existing provider personnel must first be provisioned by the backend identity workflow; the backend intentionally creates a `CUSTOMER` identity for a brand-new phone.

Bootstrap is:

```text
restore encrypted session
→ validate/refresh through GET /auth/me
→ require a current backend COMPANY_MANAGER or TEAM_LEADER_CLEANER scope
→ load backend-scoped provider companies/teams
→ provider dashboard
```

`COMPANY_MANAGER` requires a current company scope plus `company:own` and `team:company`. `TEAM_LEADER_CLEANER` requires current company/team scope plus `assignment:team` and `job:team`. Customer-only, dispatcher-only, and admin-only sessions cannot enter provider screens. A multi-role identity is accepted only when `/auth/me` includes at least one valid provider scope. Unauthorized identities see a safe access-denied screen with logout.

The backend remains authoritative. The repository does not send a locally selected company to broaden list reads. It additionally rejects a company/team response that is outside the `/auth/me` provider scopes, failing closed instead of rendering cross-company data. This is client defense in depth; NestJS authorization and database filters remain the security boundary.

## Networking and secure storage

`API_BASE_URL` is required through `--dart-define`; no production URL or credential is compiled into the application. The API client implements the existing success/error envelope, JSON serialization, bearer access tokens, request IDs, typed error mapping, a 20-second timeout, one safe retry for transport-failed GET requests, no automatic command retry, one refresh-and-replay on 401, serialized refresh rotation, caller-supplied idempotency headers, and abortable HTTP requests.

Access and refresh tokens are stored under the provider-only key `home_clean.provider.session.v1` through `flutter_secure_storage`. SharedPreferences is not used. Network diagnostic events contain method, path, outcome, status, and request ID only; headers and bodies are never logged. Tokens, OTPs, passwords, payment data, and sensitive provider fields are not logged.

Provider-safe error handling covers configuration, offline/network failure, timeout, cancellation, 400/413/422 validation, 401 expiration, 403 scope denial, 404 missing/foreign resources, 409 operational conflicts, 5xx failure, and malformed envelopes. Raw server messages, database details, and stack traces are not presented.

## Existing provider API contracts represented

Only existing backend contracts are modeled:

| Area | Existing API | Foundation contract |
|---|---|---|
| Identity/session | `/auth/*`, `GET /auth/me` | Typed session, identity, roles, company/team scopes and permissions |
| Companies | `GET /provider/companies` | Manager-visible `id`, `name`, `status`; no commission/internal code |
| Teams | `GET /provider/teams` | Scoped summary with company, code, name, status, capacity and active state |
| Offers | `GET /dispatch/offers` | Narrow offer/service/location/instructions projection |
| Notifications | `GET /notifications` | Own-user notification summary/payload/read/delivery timestamps |
| Financials | `GET /settlements` | Company-scoped settlement summaries for identities with `settlement:company` |

The backend also has scoped team/member/availability/capability/location endpoints, assignment commands, notification read/device commands, scoped payment detail, and settlement detail. Phase 13A does not execute those workflows or expose their mutation UI.

## Routing and presentation

Prepared routes are `/`, `/auth`, `/access-denied`, `/home`, `/assignments`, `/assignments/details`, `/active-job`, `/team`, `/notifications`, `/profile`, and `/financials`. Bootstrap, authentication, access denied, dashboard, profile/logout, and shared navigation are functional foundation surfaces. Feature routes are intentionally localized placeholders and cannot bypass the authentication/provider-scope guard.

The Provider design system keeps Home Clean colors while using a darker operational accent. It includes reusable typography/theme, spacing, buttons, cards, status badges, loading, error, empty, dialog, bottom-sheet, and navigation components. Domain status codes remain untranslated data; display labels are resolved by Arabic/English resources. Arabic renders RTL and English renders LTR.

## Historical Phase 13A backend gaps

At the Phase 13A checkpoint no backend code had changed. The following gaps were recorded then; assignment list/detail, offer team attribution and the cash read projection are now resolved by the Phase 13B implementation above:

1. **Scoped assignment recovery/list.** A `GET /provider/assignments?limit&offset&status?` endpoint is needed so company managers can list assignments only for their active company scopes and cleaners only for their active team scopes. It should return a narrow operational projection: assignment/booking IDs and number, targeted team identity, assignment/booking state, schedule, service snapshot, address/location/instructions, and only the cash-collection fields authorized for that actor. It must not expose customer identity, internal dispatch scores, commission, or unrelated payment data.
2. **Scoped assignment detail.** A `GET /provider/assignments/:id` endpoint with the same company/team isolation is needed to restore an accepted or active job after application restart and to support assignment detail/active-job screens. Currently `GET /dispatch/offers` returns only live `OFFERED` records; the offer disappears after acceptance, while provider roles do not have `booking:operations` for `GET /bookings/:id`.
3. **Offer team attribution for managers.** The existing `GET /dispatch/offers` response is scope-filtered but omits `companyId`, `teamId`, and a team display name. A manager with multiple teams cannot tell which team received an offer. The response needs a safe targeted-team projection or the future assignment list must replace that ambiguity.
4. **Provider cash worklist.** `GET /payments/:id` is scoped but requires a known payment ID, and there is no provider cash-collection list. Future cash UI needs assignment detail/list data that explicitly indicates server-authoritative method, exact collectible amount/currency, collection state, and assignment ID, under `cash:team`/company policy. Flutter must not derive this from booking price.

Existing `GET /settlements` and `GET /settlements/:id` are sufficient contracts for a later manager financial read experience. Settlement writes remain Home Clean finance operations and must not be exposed to a company manager.

## Validation

- `flutter pub get`: PASS; provider dependencies resolved.
- `flutter test`: **37/37 PASS**.
- `flutter analyze`: PASS with no issues after final lint correction.
- Android debug build with `API_BASE_URL=http://10.0.2.2:3000/api/v1`: PASS; APK at `mobile/provider_flutter/build/app/outputs/flutter-apk/app-debug.apk`. This is a debug build, not production readiness.
- Backend TypeScript build and unit suite: PASS, **40/40**.
- Isolated compiled provider-related backend contracts: Core/provider isolation + Dispatch + Settlements **3/3 PASS**; Phase 11 notification/location **1/1 PASS** in its own clean schema. A combined exploratory selection made Phase 11 inherit Dispatch outbox rows and failed its zero-row fixture assertion; the documented isolated rerun passed.
- Customer regression: not required because no Customer app or shared customer dependency was changed.

## Known limitations

- Foundation placeholders do not implement assignment decisions, job start/completion, team management, cash collection, settlement screens, push-token integration, live location, or production notifications.
- Provider context loads the first supported 100 company/team records. Full paging state belongs with later feature screens.
- Session/idempotency command recovery across app process termination is not implemented because operational commands are outside Phase 13A.
- The backend geocoder, push provider, and payment provider remain mock/deterministic as documented by their owning backend phases.
- No authenticated Flutter-to-live-backend device session, release build/signing, production environment, iOS build on Windows, or deployment was claimed.

## Historical Phase 13A status

**At this historical checkpoint, Phase 13A — Provider Flutter Foundation was complete and Phase 13B had not yet started.** Current status and next step are recorded at the top of this document.
