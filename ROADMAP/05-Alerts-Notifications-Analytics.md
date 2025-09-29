# Epic 5 — Alerts, Notifications, Analytics Completeness (W6–W7)

Checklist

- [ ] Alerts MVP (create/list for availability change)
- [ ] Notification service (FCM/APNs capture; worker; optional email fallback)
- [x] Analytics buffering with retry/background flushing (Redis/in-memory)
- [ ] Analytics hardening (schema validation, sampling; PostHog/Amplitude dashboard)
- [ ] Availability delta detection job (compare lastSeenAt to prior snapshot)
- [ ] Admin dashboard cards (ingest success, availability freshness, ratings coverage)
- [ ] Personalization for alerts (services/regions per profile; frequency controls)
- [ ] Multi-channel notifications (email/SMS/webhook opt-in)
- [ ] Notification preferences & pacing (quiet hours; per-channel opt-in)
- [ ] Compliance: CAN-SPAM/GDPR consent, unsubscribe links, data retention

Acceptance Criteria

- Setting an availability alert leads to a delivered push when content becomes available (device test)
- Dashboard shows CTR from picks and basic funnels
- When buffering is enabled, events are queued and flushed; failures are requeued and later delivered; unit tests cover Redis and memory paths
- Alerts are deduplicated per `titleId+profileId+service+region`
- Availability delta detection runs nightly and enqueues pushes for new SUBSCRIPTION availability
- Preferences honored; quiet hours respected; unsubscribe works

Testing Strategy

- Unit: alert creation rules; token storage; analytics validator
- Integration: availability delta → enqueue → push service called; analytics dispatched with required fields
- E2E: create alert → simulate availability change → receive notification on device
- Email/webhook smoke tests (if enabled)

Step-by-Step Implementation Plan

1. Data & API for Alerts
   - Model: `Alert(id, profileId, titleId, service, region, createdAt)` with unique `(profileId,titleId,service,region)`
   - REST/GraphQL: create/list/delete alerts; guard with RBAC and rate-limit

2. Availability Delta Detection
   - Nightly job: for each title, compare `Availability.lastSeenAt` vs previous run (or maintain a snapshot table)
   - If new SUBSCRIPTION entry appears for a title+service+region, find subscribers with matching alerts and enqueue notifications

3. Notification Service
   - Store device tokens per profile (FCM/APNs); handle token rotation
   - Worker to send notifications; exponential backoff; dead-letter queue for failures
   - Optional email fallback for unreachable devices

4. Analytics Hardening
   - Validate analytics events schema (strict fields, PII-free)
   - Dashboards: ingestion success rate, ratings coverage %, availability freshness, alert send success

Acceptance Criteria (Detailed)

- Creating an alert returns 201 and is idempotent by unique key
- Delta job logs counts (titles scanned, deltas found, notifications sent) and metrics exposed
- Push delivery success ≥ 95% in test env; failed tokens are pruned
- Analytics dashboards show non-zero events and basic funnels
