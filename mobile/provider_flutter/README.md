# Home Clean Provider Flutter

Phase 13D operational application for authorized cleaning-company personnel. This is a separate Provider application, not a Customer app variant.

## Run

```powershell
flutter pub get
flutter run --dart-define-from-file=config/development.example.json
```

`API_BASE_URL` is required and validated at startup. `APP_ENVIRONMENT` defaults to `development`; staging/production require HTTPS. Copy a public example into ignored `config/*.json` to change the URL. Never put secrets in Dart defines. See [environment configuration](../../docs/deployment.md).

## Implemented workflow

- OTP sign-in, secure rotating session bootstrap and backend provider-scope validation.
- Operational dashboard with pending offers, accepted/active work, scoped team status, recent notifications and cleaner-only cash alerts.
- Provider assignment inbox with Pending, Accepted/Active and History views.
- Backend-authoritative assignment detail and accepted-job recovery.
- Scoped accept/reject with confirmation, optional rejection reason, stable retry idempotency and duplicate-tap protection.
- Accepted-assignment to active-job navigation with backend-authoritative on-the-way, start-work, in-progress and operational-completion actions.
- Completion-proof metadata/reference submission and recovery. The app does not upload files; production object storage remains external.
- Cleaner-only exact-amount cash collection and the existing team/customer no-show actions, all executed by locked server commands.
- State recovery after restart/navigation/timeout: command transport failures retain the idempotency key and every outcome reloads assignment detail.
- Company/team context and assignment-notification navigation. Notifications only supply a reference; detail is always fetched again.
- Company-manager team management: scoped list/detail, create/update/activation, members, operational status, availability create/update/delete and service capabilities. Cleaners are restricted to their exact team and existing status/availability operations.
- Company-manager read-only settlement visibility with backend totals, completed-work context, payout records and reconciliation status. The app does not calculate financial truth or mutate payouts.
- English LTR and Arabic RTL operational terminology.

The app uses `GET /provider/assignments`, `GET /provider/assignments/:id` and, for `cash:team` cleaners only, `GET /provider/cash-worklist`. Execution calls the existing `/assignments/:id/*` Booking commands. Company managers see/operate only their active company assignments; team leaders/cleaners only their exact active team. Cash remains cleaner-only. The backend remains the authorization, job and payment state boundary.

Final Booking completion remains payment/proof-reconciliation gated on the backend; operational completion in Flutter does not bypass it. Phase 13D does not implement provider identity/member provisioning, settlement/payout mutations, object upload, production push, live GPS, production payment rails, Admin work or deployment.

## Architecture

```text
lib/
├── application/  authentication, assignment/job and team/finance state
├── core/         config, networking, errors, secure storage, localization,
│                 logging, theme, services and reusable widgets
├── data/         typed auth/provider API data sources and repositories
├── domain/       session, provider scope, assignment/job/team/finance contracts
├── presentation/ auth, dashboard, assignment inbox/detail, active job,
│                 completion/proof/cash/no-show, team, settlements, notifications/profile
├── routing/      guarded provider and assignment-detail routes
└── main.dart     composition root
```

Sessions use `flutter_secure_storage`; do not replace it with SharedPreferences. API calls stay outside widgets. The client supports structured errors, timeouts, one safe GET retry, rotating-token refresh, command idempotency headers and cancellation. Network logs are metadata-only.

## Routes

- `/` bootstrap
- `/auth`
- `/access-denied`
- `/home`
- `/assignments`
- `/assignments/details`
- `/active-job`
- `/team`
- `/notifications`
- `/profile`
- `/financials` (manager-only settlement visibility; backend scope is authoritative)

## Validate

```powershell
flutter pub get
flutter analyze
flutter test
flutter build apk --debug --dart-define-from-file=config/development.example.json
```

Current checkpoint: **73/73 tests pass**, analyzer reports no issues, and the Android debug APK builds at `build/app/outputs/flutter-apk/app-debug.apk`. A debug APK is not a production-readiness claim.

See [`../../docs/phase13-provider-app.md`](../../docs/phase13-provider-app.md) for API scopes, cash boundaries, backend validation and remaining limitations.
