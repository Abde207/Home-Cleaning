# Home Clean Customer Flutter App

Phase 12A–12E implements and validates the scoped customer application on the existing backend contracts.

Implemented surfaces include secure bootstrap/session restoration, the existing phone OTP flow, localized Home, Services and service details, Addresses CRUD and server validation, Profile editing with Arabic/English preference, Notifications, and guarded customer navigation. Booking adds service/extras selection, saved property/address, date/time, server quote and expiry, review, cash/online choice, confirmation, details/status and cancellation. The app consumes the existing NestJS APIs and never calculates authoritative prices or marks a payment successful locally.

## Development

Supply the API base URL at runtime:

```bash
flutter pub get
flutter run --dart-define-from-file=config/development.example.json
```

The Android emulator example targets the local backend on port 3001. For desktop/web or a real device, copy the public example to ignored `config/development.json` and use a reachable API URL. Staging/production builds require HTTPS and an explicit profile. Dart defines are public compile-time values; never put secrets in them. See [environment configuration](../../docs/deployment.md).

## Validation

```bash
flutter analyze
flutter test
flutter build apk --debug --dart-define-from-file=config/development.example.json
```

Current validation: `flutter pub get` passed, `flutter analyze` passed with no issues, `flutter test` passed **56/56**, and the Android debug APK passed with the environment-driven API URL. Backend TypeScript build passed. The ordinary backend test command was not used as a regression claim because it ran against the public schema; the documented isolated compiled runner is the accepted database validation path. iOS was not built on Windows.

The backend has no customer availability endpoint, customer-safe team location/ETA endpoint or customer rating API. A requested time is checked as future at booking creation and team availability is resolved later by Dispatch. The configured online checkout URL is a mock and cannot collect payment. Geocoding and push delivery remain mock/provider-ready; production FCM/APNs credentials and genuine device tokens are not configured. No authenticated Flutter-to-live-backend production session was validated, and iOS was not built on Windows. Provider App and Admin Dashboard remain later work. See [`docs/phase12-customer-app.md`](../../docs/phase12-customer-app.md) and [`docs/codex-implementation-status.md`](../../docs/codex-implementation-status.md).
