# Epic 9 — Monetization & Growth (Freemium, Affiliates, B2B) (W6–W8)

Checklist

- [ ] Freemium plan definition and gating (features, limits)
- [ ] Affiliate link instrumentation (opt-in; disclosure)
- [ ] Premium features: advanced filters, early alerts, ad-free, social analytics
- [ ] Referral/sharing growth loops; invite flow
- [ ] Basic B2B readiness (public API/embeds policy; demo dashboards)

Acceptance Criteria

- Freemium vs Premium gates enforce correctly (server-side)
- Affiliate deep links append tracking params where supported; disclosure visible
- Premium trial flow works end to end (mocked billing acceptable in MVP)
- Share/referral increases new sign-ups measurably in test cohort

Step-by-Step Implementation Plan

1. Plans & Flags

- Define plan matrix (Free vs Premium) in config; add `PLAN_ENFORCEMENT_ENABLED`
- Server-side checks for premium endpoints (early alerts, ad-free flag)

2. Affiliate Links

- Abstract deep-link builder to optionally append affiliate params per provider
- Centralize disclosure and toggles; default disabled until compliance review

3. Premium Features (MVP)

- Advanced filters (e.g., mood/duration combos); early alerts window; ad-free toggle
- Social analytics page (friends' trends summary) for premium users

4. Growth Loops

- One-click share of Picks/List; referral invite link with attribution code
- Track shares → sign-ups; basic anti-abuse checks

5. B2B Readiness

- Public embed widget (read-only) policy; rate limits; API keys per partner (later)
- Demo dashboards (OpenSearch/Kibana or lightweight UI)

Testing Strategy

- Unit
  - Plan gate checks; affiliate param builder correctness per provider
  - Referral code attribution logic
- Integration
  - Premium-only endpoints reject non-premium users; trial enables features
  - Share → sign-up attribution recorded; affiliate links generated when flag on
- E2E
  - Upgrade to premium → early alerts available and ad-free applied
  - Referral link → new user → attribution visible in admin metrics

Metrics & Telemetry

- Conversion: free→premium; premium retention
- Revenue: affiliate conversions; premium MRR
- Growth: referral sign-ups; share rate; K-factor
- Compliance: affiliate toggles usage; disclosure impression rate
