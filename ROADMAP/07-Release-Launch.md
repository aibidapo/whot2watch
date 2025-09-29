# Epic 7 — Release & Launch (W9–W10)

Checklist

- [ ] Beta builds: TestFlight (iOS), Internal (Android)
- [ ] Feature flags for alerts and Private Mode
- [ ] API rollback plan (blue/green/canary)
- [ ] GTM basics (waitlist, in‑app NPS), support FAQ
- [ ] Launch plan sync with Content & Marketing (PR, influencers, referral)
- [ ] App store listings updated (ASO from Epic 3); web SEO checks green
- [ ] Legal docs (ToS, Privacy) published; data export/deletion documented

Acceptance Criteria

- No Sev‑1 bugs open; E2E top flows pass
- P50 picks < 300ms; P95 picks < 600ms (staging)
- Crash‑free sessions > 99%
- Rollback rehearsed; on-call rotations assigned; runbooks linked

Testing Strategy

- Release checklist verification; smoke E2E on staging builds; rollback rehearsal
- GTM dry‑run: landing, referral, influencer post; tracking verified
