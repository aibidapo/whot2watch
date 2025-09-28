# Epic 7 — Release & Launch (W12)

Checklist

- [ ] Beta builds: TestFlight (iOS), Internal (Android)
- [ ] Feature flags for alerts and Private Mode
- [ ] API rollback plan (blue/green/canary)
- [ ] GTM basics (waitlist, in‑app NPS), support FAQ

Acceptance Criteria

- No Sev‑1 bugs open; E2E top flows pass
- P50 picks < 300ms; P95 picks < 600ms (staging)
- Crash‑free sessions > 99%

Testing Strategy

- Release checklist verification; smoke E2E on staging builds; rollback rehearsal
