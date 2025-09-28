# Epic 5 — Alerts, Notifications, Analytics Completeness (W9–W10)

Checklist

- [ ] Alerts MVP (create/list for availability change)
- [ ] Notification service (FCM/APNs capture; worker; optional email fallback)
- [ ] Analytics hardening (schema validation, sampling; PostHog/Amplitude dashboard)

Acceptance Criteria

- Setting an availability alert leads to a delivered push when content becomes available (device test)
- Dashboard shows CTR from picks and basic funnels

Testing Strategy

- Unit: alert creation rules; token storage; analytics validator
- Integration: availability delta → enqueue → push service called; analytics dispatched with required fields
- E2E: create alert → simulate availability change → receive notification on device
