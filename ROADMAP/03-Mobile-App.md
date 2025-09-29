# Epic 3 — Mobile App (React Native/Expo) (W4–W6)

Checklist

- [ ] App scaffold (Expo), navigation (Home, Search, Lists, Settings), design tokens
- [ ] Onboarding (services, region, taste) → persist preferences & subscriptions
- [ ] Daily Picks UI (3–5 cards, Why this?, Like/Dislike/Save, Watch Now)
- [ ] Search UI (filters, availability badges)
- [ ] Title detail (overview, availability, actions)
- [ ] Lists (My List + CRUD)
- [ ] Settings (subscriptions, preferences, Private Mode toggle, Alerts list)
- [ ] Analytics wiring via `Tracker`
- [ ] AI chat (concierge) screen behind feature flag
- [ ] Social feed (friends' likes/saves) and Friends' Picks tab
- [ ] Share My Picks/List (OG cards)
- [ ] Optional offline cache for Picks and Lists (flagged)
- [ ] Push notification readiness (token capture, permission flows)
- [ ] Crash reporting (Sentry/Expo) and performance monitoring
- [ ] App Store Optimization (ASO): metadata, keywords, review prompts

Acceptance Criteria

- Onboarding → Picks → Watch Now flow works end to end
- Search → Save flow works
- Private Mode suppresses analytics events (dev logs verify)
- AI chat produces results or falls back to filters; errors surfaced as toasts
- Social feed shows friend actions; sharing opens correct in-app route with OG preview

Testing Strategy

- Unit
  - UI components render; state updates; analytics calls mocked and verified
  - Chat reducer and NLU mapper produce expected filter payloads
- Integration
  - Navigation flows; network calls stubbed; error toasts on deep link failure
  - Chat → results; feed fetch and rendering; share link generation
  - Offline cache warm/fill; push token capture
- E2E (Detox)
  - Onboarding to Picks to Watch Now
  - Search and Save to list
  - Private Mode toggle prevents analytics sends
  - AI chat roundtrip with fallback; share flow renders OG and deep-links correctly
