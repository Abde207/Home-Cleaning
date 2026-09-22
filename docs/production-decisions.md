# Production Decisions Audit — platform baseline

Date: 2026-09-22. Scope: read-only examination of [production-readiness-audit.md](production-readiness-audit.md), [codex-implementation-status.md](codex-implementation-status.md), [api.md](api.md), and the repository. This is a decision inventory, not Phase 15 or an integration plan already approved for execution. No provider, account, launch feature, or credential is selected here. Credential names below describe items to obtain and store in a secret manager; they are not requests to put values in this document or Git.

## Decision matrix

“Options” are examples or architectural choices, not endorsements. Staging means an isolated, reproducible environment with test data and nonproduction provider accounts. Production means separately owned live accounts, keys, domains, and approval. Owners are decision roles to assign, not named people.

| Category | Current State | Decision Required | Available Options | Repository Impact | Credentials Required | Staging Requirement | Production Requirement | Decision Owner |
|---|---|---|---|---|---|---|---|---|
| OTP/SMS | File sender locally; Twilio HTTP branch exists, unvalidated | SMS provider, sender identity, countries, message/consent/failure policy | Validate Twilio branch; implement another SMS adapter | Auth sender, environment validation, templates/telemetry | Provider account/API auth, approved sender, OTP hash secret | Test sender/account, real handset delivery and failure | Live sender approval, limits, monitoring, rotation | Product + Security + Backend/Ops |
| Payment gateway | `MockPaymentProvider` only; mock webhook/refund | Gateway, JOD support, checkout model, refunds, settlement/reconciliation, launch payment scope | Hosted checkout vs SDK; candidate gateways subject to commercial/technical review; cash-only launch only if business/API flow is explicitly revised | Payment adapter, config, webhook/refund lifecycle; Customer checkout; Admin finance visibility | Sandbox/live merchant keys, webhook verification material, merchant IDs; possibly return URL settings | Sandbox checkout, callback, refund and reconciliation | Live merchant approval, callback, payout/reconciliation operations | Finance + Product + Security + Backend |
| FCM / Android push | Mock push; device API; no platform token source | Android push transport, app/project ownership, notification criticality | FCM directly; broker that uses FCM | Backend provider; both Flutter token/permission lifecycles | Project/app IDs, server service identity; Android client config | Separate test app/project and device tests | Live project, restricted server identity, monitored delivery | Mobile + Backend + Product/Ops |
| APNs / iOS push | No iOS push integration | Direct APNs or FCM bridge; topics, environment, alert policy | APNs direct; FCM with APNs credentials | Backend provider or FCM bridge; both Flutter iOS entitlements/token handling | Apple team/key ID/auth key or certificates, bundle topics; if bridged, Firebase config | APNs sandbox or Firebase test project; signed iOS device build | Live APNs environment, production topic/credentials, monitoring | Mobile + Backend + Apple account owner |
| Maps/geocoding/routing | Deterministic geocoder; approximate distance/ETA | Provider(s), address precision, service-area rule, whether road routing/ETA is launch critical | One managed API; separate geocoder/router; approved hosted/open-data service; no live ETA if product explicitly accepts it | Location adapter and dispatch scoring; Customer address UX; Admin area review | Server API keys/token, billing/quota; client key only if maps SDK chosen | Test key, Jordan addresses, quotas, failure cases | Restricted live keys, billing limits, coverage/fallback | Product/Operations + Backend + Security |
| Object storage | Proof metadata/key only; no upload | Storage provider, upload/download flow, required evidence type, retention | S3-compatible/managed bucket; other approved object service | Proof API, validation/authorization, Provider capture/upload, Admin access | Bucket/container IDs, workload identity or access keys, signing credentials if needed | Isolated bucket, test media and access/expiry tests | Private bucket, lifecycle, encryption, backup/retention | Product/Operations + Platform + Security |
| PostgreSQL | Prisma; seven migrations; local Postgres 16 | Managed/self-hosted service, region, HA, pooler, backup/PITR, RPO/RTO | Managed PostgreSQL; operated PostgreSQL cluster | Connection/TLS/pool config, migration job, restore runbook | DB URL/user/password or workload identity, TLS CA/client material | Separate DB, `btree_gist`, migrate/seed and restore rehearsal | HA, least privilege, PITR, tested restore and capacity | Platform + DBA/Security |
| Redis | Auth limits; local Redis 7 AOF | Managed/operated service, TLS/auth, failover and outage policy | Managed Redis; operated Redis | URL/TLS config, health and failover handling | Redis endpoint/password or identity, CA if applicable | Isolated instance, auth/failover tests | Private network, monitoring, capacity and recovery policy | Platform + Backend |
| Backend hosting / workers | Nest API binds loopback; workers are in-process timers; no image/service definition | Host/runtime, region, ingress, worker topology and scale | Container service/cluster; VM/service; single bounded instance vs dedicated worker | Listener/config, images/manifests, readiness, stale-claim recovery | Registry/deploy identities, runtime service identity | Reachable API and bounded worker, smoke/crash tests | HA/capacity, worker lag/replay, controlled rollout | Platform + Backend/Ops |
| Admin hosting | Next BFF builds; no deploy unit; refresh coalescing process-local | Host/runtime, instance count, backend path, origin/cookie policy | Container/VM; managed Next host; single instance until shared refresh coordination | Build/deploy config, `BACKEND_API_URL`, refresh coordination if scaled | Deploy identity; backend TLS trust; no browser-side backend secret | HTTPS Admin URL, single-instance policy or tested coordination | Trusted origin/proxy, HA decision, access/uptime monitoring | Platform + Web/Security |
| Domain / HTTPS | Localhost CORS; no public DNS/TLS/proxy | Staging/live API and Admin names, certificate/DNS owner, ingress topology | Managed LB/proxy certs; operated reverse proxy/certs | CORS, API URLs, proxy/host policy, webhook routing, cookies | DNS registrar access, certificate/ACME account or managed cert permissions | Distinct HTTPS domains and exact origins | Renewing certs, HSTS, secure cookies, trusted forwarding | Platform + Security |
| Monitoring / error tracking | Request logs, health, audit; no central alerts | Tooling, retention, data redaction, alerts/on-call owner | Cloud-native stack; hosted observability; self-hosted stack | Instrumentation, dashboards, alert definitions; optional Flutter/Admin SDKs | Ingestion DSN/token, alert-routing credentials | Alert and error pipeline exercised | On-call, SLOs, incident retention and access control | Operations/SRE + Security |
| CI/CD | Local scripts only | CI host, registry, gate/approval model, staging/production promotion | Hosted CI; self-hosted runners | Workflow, build/sign/deploy scripts, migration gate | CI identity, registry/deploy tokens, signing material via secrets | Reproducible build/test/deploy and smoke | Protected release approval, immutable artifacts, rollback | Engineering/Release + Platform |
| Secrets management | Ignored local `.env`; placeholders | Secret store, ownership, scopes, injection/rotation/audit | Cloud secret manager; vault; CI + runtime secret stores | Config validation, removal of unsafe fallbacks, deploy injection | Store admin/recovery identity; per-service runtime identities | Distinct nonproduction secrets and rotation drill | Live scoped secrets, rotation/audit and break-glass | Security + Platform |
| Android signing | Both release Gradle variants use debug key | App IDs/ownership, keystore custody, distribution track | Play App Signing with protected upload key; controlled in-house key | Both Gradle release configs, build pipeline, Customer INTERNET manifest | Upload/release keystore, alias/passwords, Play account/service access | Separately signed test artifacts/install tests | Protected upload key, store enrollment, versioned rollout | Mobile/Release + Product account owner |
| iOS signing | Bundle IDs exist; no macOS build/signing evidence | Apple team, bundle IDs, distribution and push entitlements | Automatic or managed/manual signing; TestFlight distribution | Xcode project, entitlements, build pipeline, both Flutter apps | Apple team access, distribution cert/profile or managed signing identity, App Store Connect access | Signed device/TestFlight builds on macOS | App Store distribution, certificate/key custody, versioned rollout | Mobile/Release + Apple account owner |

## Dependency-by-dependency implementation and validation inventory

The “production provider” in each entry is a provider **type** that must be selected or confirmed by its owner. Staging may use sandbox/test credentials; local mocks can validate code contracts without live credentials but cannot certify real delivery. “Backend / Flutter / Admin” describes eventual work, not work authorized by this audit.

### 1. OTP/SMS

- **Purpose/current/provider:** Verify phone ownership for Customer, Provider and Admin sessions. `OtpSender` writes a local file or calls Twilio Messages; production config currently requires Twilio mode. Decide whether to operationalize Twilio or change the sender/config for another approved SMS provider.
- **Credentials/config:** `OTP_HASH_SECRET`, `OTP_DELIVERY_MODE`, and, for the existing branch, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`; sender registration, allowed countries, spend caps and environment-specific templates. Another provider changes the fields.
- **Future Backend / Flutter / Admin:** Backend needs delivery outcome mapping, retries/limits, redacted telemetry and provider config. Both Flutter apps and Admin already use OTP APIs; add delivery/resend/error copy and timing only if provider or policy changes require it.
- **Callback/security:** No inbound SMS callback exists. Decide whether delivery-status callbacks are needed; if used, authenticate them, constrain ingress, deduplicate, and keep message/phone data out of logs. Protect OTP secrets, request limits, sender reputation and abuse budgets.
- **Testing/staging/production:** Unit tests and file-mode auth flows work without production credentials. Real delivery needs a provider test or live sender account and handset checks, including failure/rate-limit cases. Staging uses isolated sender credentials and approved test numbers; production requires registered sender, alerting, secret rotation and delivery monitoring.

### 2. Payment gateway

- **Purpose/current/provider:** Online checkout, verified payment result and online refunds. `PaymentProvider` defines create/refund/webhook verification; `PaymentService` always constructs `MockPaymentProvider`, and config accepts only `mock`. Select a merchant gateway and approve JOD precision, supported methods, fees, payouts and refund behavior. Cash is a separate implemented flow, not a substitute for an approved online-payment launch decision.
- **Credentials/config:** Distinct sandbox/live merchant account and API key/secret or OAuth identity, merchant/site IDs, webhook signing secret/public key as applicable, allowed return/cancel URLs, currency and payout settings. Current `PAYMENT_WEBHOOK_SECRET` is mock-only; a hardcoded local fallback exists in `PaymentService` and needs removal before a real adapter.
- **Future Backend / Flutter / Admin:** Backend needs adapter/config selection, provider-specific event mapping, asynchronous refund strategy, timeouts/idempotency/reconciliation and error handling. Customer Flutter must launch and safely resume selected checkout, then reload server payment state. Provider Flutter generally has no gateway SDK requirement; its cash/job state remains server-owned. Admin needs operational visibility for failed/late payments, refunds and reconciliation; any actions require explicit approved permissions.
- **Callback/security:** Existing public `POST /api/v1/webhooks/payments/:provider` captures raw body and uses mock `x-payment-signature`; real signing scheme, timestamp/replay window, provider event IDs, ingress allowlisting if feasible, callback URL registration and return-link rules depend on the gateway. Never trust a client redirect as payment truth. Protect keys, card-data boundary and finance access.
- **Testing/staging/production:** Mock tests need no production credentials. Gateway certification needs sandbox credentials and simulated success, duplicate, forged, late, partial/failure and refund events. Staging needs public HTTPS callback plus sandbox checkout/refund reconciliation. Production needs live merchant approval, live webhook registration, settlement operations and alert ownership.

### 3. FCM (Android push)

- **Purpose/current/provider:** Android delivery of persisted notification events. Backend injects `MockPushNotificationProvider`; `/devices` stores tokens. Customer has a token registration controller but no platform token source; Provider currently has notification inbox reads without a push registration path. Select FCM project/transport or an approved broker that uses FCM.
- **Credentials/config:** Environment-specific Firebase project/app IDs, Android client configuration, server service identity/permissions (or broker credentials), package names and signing fingerprints where needed. Client config is not a server secret.
- **Future Backend / Flutter / Admin:** Backend provider adapter, error normalization, token invalidation, delivery metrics and stale-`SENDING` recovery. Both Flutter apps need permission/token acquisition, refresh, registration/removal, foreground/background handling and safe navigation to authoritative records. Admin can read delivery state today; add provider-specific diagnostics/operations only after policy approval.
- **Callback/security:** No inbound FCM webhook is required by current design; decide whether delivery receipts or analytics are needed. Keep payloads minimal, avoid sensitive business data, restrict service identity and redact provider errors/device tokens.
- **Testing/staging/production:** Mock delivery works without production credentials. Real device delivery needs an FCM test project and physical/emulated devices with configured app identity. Staging uses separate project and test devices; production uses live project, quotas, failure alerts and rotation.

### 4. APNs (iOS push)

- **Purpose/current/provider:** iOS notification delivery for both apps. No APNs/Firebase platform integration or entitlements are configured. Choose direct APNs or FCM as the APNs bridge; decide topics and critical notification behavior.
- **Credentials/config:** Apple team ID, APNs key ID and `.p8` auth key or certificate, separate app bundle IDs/topics and sandbox/production environment; FCM bridge also needs Firebase project/app config and APNs credentials registered there.
- **Future Backend / Flutter / Admin:** Backend provider/token routing must distinguish iOS transport and invalid-token responses. Both Flutter apps need iOS permission, entitlement, token refresh, foreground/background handling and registration; Admin only needs delivery diagnostics/approved operations.
- **Callback/security:** Current architecture has no APNs inbound callback. Protect APNs key and topics, avoid sensitive payloads, and honor opt-out/token removal.
- **Testing/staging/production:** Backend mock tests need no production credentials. Real APNs requires Apple developer access, signed iOS app and device; sandbox is sufficient for staging tests. Production needs production APNs path, monitored delivery and certificate/key rotation plan.

### 5. Maps, geocoding and routing

- **Purpose/current/provider:** Resolve customer addresses and support service-area/dispatch decisions. `GeocodingProvider` is deterministic; reverse method exists but no public reverse API. Dispatch uses approximate straight-line distance and configured travel speed. Select geocoding coverage and decide whether road routing/ETA is required at launch.
- **Credentials/config:** Server geocode/route keys or workload identity, allowed APIs, geography, rate/quota/billing ceilings, terms for storing results; client map key only if map UI is selected.
- **Future Backend / Flutter / Admin:** Backend provider adapter, validation/confidence and fallback, plus routing/scoring changes if road ETA is approved. Customer Flutter may need address suggestions/map confirmation; Provider Flutter may need navigation link or route display only if in scope. Admin needs area/coordinate review and operational correction if approved.
- **Callback/security:** Usually outbound API only; no current callback. Restrict keys by API and origin/service, avoid logging raw addresses, enforce quotas and decide acceptable degradation when provider fails.
- **Testing/staging/production:** Deterministic tests need no production credentials; provider accuracy needs test key, representative Jordan addresses, edge/service-area cases and route/fallback tests. Staging uses restricted test quotas; production requires commercial coverage, monitored quota and approved address acceptance policy.

### 6. Object storage / completion proof

- **Purpose/current/provider:** Hold actual completion media while the database stores immutable `storageKey`, MIME and size. Provider Flutter currently submits a typed reference/metadata, not file bytes. Select an object store and decide whether proof media is mandatory for launch and what form is allowed.
- **Credentials/config:** Separate staging/live bucket/container, region, workload identity or scoped access keys, encryption key policy, signed URL expiry, size/type limits, retention/versioning and backup settings.
- **Future Backend / Flutter / Admin:** Backend needs authenticated upload initiation/finalization, ownership/key validation, content verification/scanning, authorized download and cleanup. Provider Flutter needs capture/pick/upload/retry/progress and server confirmation. Customer Flutter has no current proof upload need; access only if product explicitly approves it. Admin needs narrowly authorized proof view/review and audit if operationally required.
- **Callback/security:** Direct browser/mobile uploads may use expiring signed URLs; completion callback/finalize endpoint and object-created events depend on architecture. Keep bucket private; verify uploaded object before accepting metadata, prevent key substitution, scan content, enforce retention and access logging.
- **Testing/staging/production:** Metadata contract tests need no production credentials; storage behavior needs an isolated test bucket or compatible local emulator. Staging tests expiry, wrong-user access, malformed/oversized files and cleanup. Production needs private bucket, recovery/retention and access audit.

### 7. PostgreSQL

- **Purpose/current/provider:** Authoritative business, auth, finance, audit and outbox persistence through Prisma. Local Compose runs PostgreSQL 16; seven ordered migrations require `btree_gist`. Select managed or operated PostgreSQL, region, availability, pooler and recovery objectives.
- **Credentials/config:** Environment-specific `DATABASE_URL`, application/migration roles or workload identities, TLS CA/client material as chosen, connection/pool/statement timeout settings and backup operator access.
- **Future Backend / Flutter / Admin:** Backend config, migration job, pooling, readiness and retention; no direct Flutter or Admin database access. Admin stays behind backend APIs; operational restore/audit views may be added only if approved.
- **Callback/security:** No webhook. Private network, TLS, least privilege, encryption, backups/PITR, restore tests, migration checksums and separation of migration role from runtime role.
- **Testing/staging/production:** Fresh local DB tests need no production credentials. Staging needs isolated provisioned DB, extension grant, all migrations/seed, backup and restore rehearsal. Production needs HA/PITR, RPO/RTO, capacity monitoring, controlled migration/forward-fix and reviewed retention.

### 8. Redis

- **Purpose/current/provider:** OTP/refresh request-rate limits and readiness dependency; not financial source of truth. Local Compose Redis 7 has AOF but no auth/TLS. Select managed or operated Redis, topology and outage policy.
- **Credentials/config:** Environment-specific `REDIS_URL`, password/identity and TLS trust material, network and resource limits.
- **Future Backend / Flutter / Admin:** Backend TLS/timeout/reconnect/health behavior and abuse handling; neither Flutter app connects to Redis. Admin should only see backend availability/operational status via approved APIs or monitoring.
- **Callback/security:** No callback. Private access, TLS/auth, key expiry, alerting and failover policy; assess whether rate-limit continuity must survive failover.
- **Testing/staging/production:** Local Redis tests need no production credentials. Staging needs isolated secured Redis and restart/failover checks. Production needs capacity, auth rotation, monitoring and recovery runbook.

### 9. Backend hosting and workers

- **Purpose/current/provider:** Run Nest API plus dispatch/notification polling. `main.ts` binds `127.0.0.1`; workers run timers in app processes; no backend image or deployment definition. Select hosting/runtime, region, worker topology, scaling and operator ownership.
- **Credentials/config:** Registry/deploy identity, runtime service identity, environment variables/secrets, private DB/Redis network and ingress/service URL. No host vendor selected.
- **Future Backend / Flutter / Admin:** Backend needs configurable listener, images/startup, readiness/drain, worker separation or bounded co-residence, stale `SENDING` recovery and replay/lag signals. Both Flutter apps need environment-specific HTTPS API URLs. Admin needs reachable `BACKEND_API_URL` ending `/api/v1`.
- **Callback/security:** Public ingress includes payment webhook and API; apply TLS/proxy trust, request limits, network controls and narrow worker permissions. Decide worker callback/health and shutdown behavior.
- **Testing/staging/production:** Local builds/process tests need no hosting credentials. Staging requires deploy identity, reachable ingress, migration order, crash/restart and smoke tests. Production requires capacity/HA, safe rollout, alerts and incident rollback/forward-fix.

### 10. Admin hosting

- **Purpose/current/provider:** Host the Next.js server-side BFF and dashboard. `BACKEND_API_URL` is server-only; cookies are HTTP-only/SameSite Strict/Secure in production. Refresh coalescing is process-local. Select hosting/runtime and single-instance vs shared refresh design.
- **Credentials/config:** Hosting/deploy identity, DNS/TLS controls, backend URL and trusted CA if private TLS; no backend bearer key is configured for browser use.
- **Future Backend / Flutter / Admin:** Backend must accept exact Admin origin/API traffic and protect Admin routes; Flutter unaffected. Admin needs deployment config, separate typecheck gate, trusted host/proxy/cookie policy and shared refresh coordination before multiple instances.
- **Callback/security:** Browser same-origin BFF mutations and `/api/session/*` are internal callbacks, not provider webhooks. Protect cookie scope, forwarded host, CSRF/origin checks and Admin access logs.
- **Testing/staging/production:** Local Next tests need no production credentials. Staging requires HTTPS Admin domain, session/refresh test and either one instance or a tested shared coordinator. Production needs monitored availability, recovery and documented scale choice.

### 11. Domain and HTTPS

- **Purpose/current/provider:** Trustworthy API/Admin ingress, webhook URL and mobile endpoint. Current CORS example is localhost and Admin production URL validation requires HTTPS off localhost. Select domains, DNS/cert management, ingress/proxy and origin policy.
- **Credentials/config:** DNS account/API token, TLS certificate or managed-certificate authorization, staging/live hostnames, `CORS_ORIGINS`, `BACKEND_API_URL`, Flutter `API_BASE_URL`, webhook URLs.
- **Future Backend / Flutter / Admin:** Backend listener/proxy/host/CORS setup; both Flutter build profiles point to approved API URL; Admin backend URL, cookie/host policy and HTTPS redirects.
- **Callback/security:** Payment callback must be public HTTPS. Enforce certificate renewal, HSTS, trusted proxy headers, exact origins, TLS version/ciphers and host allowlist; avoid exposing private DB/Redis.
- **Testing/staging/production:** Local self-signed/proxy tests need no production credentials. Staging needs distinct resolvable HTTPS hosts and provider callback reachability. Production needs owned DNS, automated renewal, monitoring and incident access.

### 12. Monitoring and error tracking

- **Purpose/current/provider:** Detect failures across API, Admin, apps, DB, workers and external rails. Repository has request IDs/logs, health and audit but no central collector/alerts. Select observability provider/stack, retention and on-call route.
- **Credentials/config:** Ingestion DSNs/API tokens, project IDs, alert delivery integration, service identities; keep staging/live separate.
- **Future Backend / Flutter / Admin:** Backend metrics/traces/error redaction and outbox/worker/payment signals; Flutter crash/error reporting if approved; Admin server/client error instrumentation and uptime checks.
- **Callback/security:** Alert delivery may use outbound webhooks; incoming status callbacks are optional. Strip OTP, tokens, payment raw payloads, addresses and personal data; restrict access and retention.
- **Testing/staging/production:** Local logs/health need no production credentials. Staging sends synthetic failures and verifies alert routing. Production requires active alert ownership, thresholds, retention and response runbooks.

### 13. CI/CD

- **Purpose/current/provider:** Reproduce validation and promote immutable artifacts. Only local scripts exist. Select CI runner, artifact registry, branch gates, migration and release approval model.
- **Credentials/config:** Repo/CI identity, registry and deployment tokens, ephemeral DB/test secrets, cloud workload federation or short-lived credentials, signing access, store submission tokens if automated.
- **Future Backend / Flutter / Admin:** Backend build/integration/migration and image gates; both Flutter apps analyze/test/build/sign; Admin separate typecheck/test/build and deploy smoke gate.
- **Callback/security:** Git/CI webhooks depend on platform; protect branch rules, least-privilege runners, artifact provenance, secret masking, dependency scans and manual production approval.
- **Testing/staging/production:** Local scripts need no production credentials. Staging pipeline needs nonproduction deploy/signing access and fresh-schema tests. Production pipeline needs protected environment, immutable promotion and audited approval.

### 14. Secrets management

- **Purpose/current/provider:** Store provider/runtime/signing secrets. `.env` is ignored; `.env.example` has placeholders and no full production inventory. Select secret store and ownership/rotation process.
- **Credentials/config:** Store admin/recovery identity, per-service read identities, secret names/versions for DB, Redis, OTP, payment, push, maps, storage, monitoring, CI and signing. Never place values in docs, Git or Flutter compile-time definitions.
- **Future Backend / Flutter / Admin:** Backend typed validation and removal of mock webhook secret fallback; Flutter receives only public environment configuration (not server secrets); Admin gets only server-side URL and any future server-only credentials.
- **Callback/security:** No callback by default; rotation events may trigger redeploy. Enforce environment separation, least privilege, audit, expiration/rotation and break-glass recovery.
- **Testing/staging/production:** Config shape can be tested with dummy secrets; staging must use its own real test credentials and rotation drill. Production needs separately scoped live secrets and access review.

### 15. Android signing

- **Purpose/current/provider:** Release trusted Customer/Provider Android apps. Both Gradle release configs reference debug signing; Customer main manifest lacks INTERNET. Select package ID ownership, Play account/track and key custody.
- **Credentials/config:** Protected upload/release keystore, alias/passwords, Play Console account/service identity; if FCM uses fingerprints, register the correct signing identities. Keep Customer and Provider identities separate.
- **Future Backend / Flutter / Admin:** Backend may need app link/allowed callback configuration; both Flutter Android projects need release signing, Customer INTERNET fix, versions and push permissions/config. Admin has no code dependency, but release operations may surface status.
- **Callback/security:** App links/checkout redirects if selected require verified domains. Never commit keystores/passwords; test key loss, rotation and store ownership.
- **Testing/staging/production:** Debug builds need no production signing credential. Staging needs protected test signing/internal track and install/update/network tests. Production needs store-accepted signed bundles, rollout and rollback plan.

### 16. iOS signing

- **Purpose/current/provider:** Build/distribute trusted iOS variants of both apps; current Windows audit cannot verify builds. Select Apple team, final bundle IDs, signing method and TestFlight/App Store workflow.
- **Credentials/config:** Apple Developer/App Store Connect access, distribution certificate/profile or managed signing identity, provisioning for both bundle IDs, APNs key/entitlements and protected CI access.
- **Future Backend / Flutter / Admin:** Backend may need universal-link/payment return configuration; both Flutter iOS projects need signing, push capabilities, versioning and macOS build/test. Admin has no direct app-signing change.
- **Callback/security:** Universal links or payment return links require domain association if chosen. Protect certificates/APNs keys and restrict CI/App Store Connect roles.
- **Testing/staging/production:** Flutter unit tests need no production signing credential. Device/TestFlight validation requires Apple team access and staging profiles; production requires distribution signing, App Store metadata/review and monitored rollout.

## Cross-cutting decisions that gate implementation

1. **Launch scope and business rules:** Decide whether online payment, push, road ETA, actual proof media and live location are launch requirements; approve service geography, catalog/prices, JOD precision/tax treatment, refunds/cash/settlement policy, notification content and Admin provisioning. The seed has only inactive zero-price drafts. This decision determines which adapters and mobile UX are mandatory before staging acceptance. The current online-payment and proof-dependent flows cannot be called live with mock checkout or metadata alone.
2. **Trust and environment boundary:** Decide staging/live domains, region/data residency, HTTPS ingress, network segmentation, secret owner/store and separate provider accounts. These choices block callback registration, Admin cookie/origin verification, mobile API profiles, CI deployment and credential issuance.
3. **Data/recovery baseline:** Decide PostgreSQL hosting, `btree_gist` availability, pooler, backup/PITR and RPO/RTO; Redis hosting/failover; object retention if proof is in scope. This blocks meaningful migration, worker and restore rehearsals.
4. **Payment gateway:** Gateway/checkout mode and refund settlement semantics block adapter design, webhook verification contract, Customer redirect/resume behavior, finance reconciliation and payment alerting. Obtain sandbox credentials and callback registration only after that choice.
5. **Push transport:** FCM project and direct-APNs-vs-FCM bridge choices, bundle/package IDs and signing ownership block real token acquisition, backend routing and device delivery tests. Signing and push decisions are linked.
6. **Maps and proof:** Address accuracy/service-area policy determines geocoding/routing choice and dispatch calibration. Proof media policy determines bucket, capture UX, validation and Admin access. These are product/privacy decisions before provider selection.
7. **Runtime topology:** Backend host/worker design and Admin instance count block ingress, health, stale-claim recovery, shared refresh coordination and capacity tests. Notification worker stale-`SENDING` recovery is required before relying on push; multiple Admin instances require shared refresh coordination.
8. **Delivery and ownership:** CI provider/registry, signing custody, monitoring/on-call, migration approval, restore responsibility and legal/privacy retention are required for a reproducible staging gate and later production promotion.

## Recommended dependency order (decisions, then later work)

1. Product/Finance/Operations approve launch scope and commercial/privacy policies; assign named decision owners.
2. Platform/Security approve region, staging/live domains, secret store, network/TLS and data recovery targets.
3. Select PostgreSQL, Redis, backend/Admin hosting and worker topology; decide Admin scaling. Establish a reproducible staging platform with no live customer data.
4. Select SMS, payment, FCM/APNs, maps and object-storage providers as required by approved launch scope; obtain separate sandbox/test credentials and callback/app registrations.
5. Approve Android/iOS identities and signing custody; align app identifiers and push/payment return domains.
6. Implement credentialed adapters and operational fixes in a later authorized work package; test callbacks, failures, workers, release artifacts and real devices against staging.
7. Build CI/CD, observability and backup/restore gates; rehearse staging end to end, then separately approve live credentials and production promotion.

Current outcome: these decisions and credentials are **unresolved** unless independently supplied by the named owners. This document does not assert that a production account exists, that a provider supports this app's commercial requirements, or that staging is ready.
