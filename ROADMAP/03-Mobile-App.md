# Epic 3 — Mobile App (React Native/Expo) (W5–W8)

Checklist

- [ ] App scaffold (Expo), navigation (Home, Search, Lists, Settings), design tokens
- [ ] Onboarding (services, region, taste) → persist preferences & subscriptions
- [ ] Daily Picks UI (3–5 cards, Why this?, Like/Dislike/Save, Watch Now)
- [ ] Search UI (filters, availability badges)
- [ ] Title detail (overview, availability, actions)
- [ ] Lists (My List + CRUD)
- [ ] Settings (subscriptions, preferences, Private Mode toggle, Alerts list)
- [ ] Analytics wiring via `Tracker`

Acceptance Criteria

- Onboarding → Picks → Watch Now flow works end to end
- Search → Save flow works
- Private Mode suppresses analytics events (dev logs verify)

Testing Strategy

- Unit
  - UI components render; state updates; analytics calls mocked and verified
- Integration
  - Navigation flows; network calls stubbed; error toasts on deep link failure
- E2E (Detox)
  - Onboarding to Picks to Watch Now
  - Search and Save to list
  - Private Mode toggle prevents analytics sends

