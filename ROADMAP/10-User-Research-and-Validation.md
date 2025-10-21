# Epic 10 — User Research & Validation (W2–W12)

Checklist

- [ ] Research ops: interview scripts, consent, notes template
- [ ] In-product feedback widget (flagged; non-blocking)
- [ ] A/B testing harness (flag-driven variants)
- [ ] Funnel and event taxonomy (activation, picks CTR, shares, alerts)
- [ ] Competitive tracking cadence (monthly feature gap review)

Acceptance Criteria

- Interviews conducted each milestone with synthesized insights driving backlog changes
- Feedback widget captures categorized inputs (bugs/ideas/UX), triaged weekly
- A/B tests can be launched via flags and analyzed in dashboards
- Competitor watch document updated monthly with action items

Step-by-Step Implementation Plan

1. Research Ops

- Create interview guides for onboarding, picks, and AI chat
- Store notes in a shared doc; tag themes and pain points

2. Feedback Collection

- Add `/feedback` endpoint and minimal UI widget (toggle via flag)
- Categorize: bug, idea, confusion; capture route/context

3. Experimentation

- Add variant flags (e.g., `PICKS_V2_ENABLED`)
- Define success metrics and runbook; add dashboards for CTR/retention deltas

4. Competitive Tracking

- Monthly review of JustWatch/ReelGood/Letterboxd updates; maintain gap log

Testing Strategy

- Unit: feedback payload validation; flag parsing; event taxonomy validation
- Integration: feedback stored and surfaced in admin console; experiment toggles variant paths
- E2E: enable variant → measure CTR change; ensure opt-out of feedback in Private Mode















