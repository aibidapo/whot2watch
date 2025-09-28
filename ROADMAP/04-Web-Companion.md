# Epic 4 — Web Companion (Next.js lite) (W9–W10)

Checklist

- [x] Search page with filters (query, service, region) and pagination (Load more)
- [x] Trending now section from /search
- [x] Rating badge (yellow star) and platform chips
- [x] Theming (dark/light toggle), header search
- [x] Dev convenience script `pnpm dev:all`
- [x] Picks page wired to backend (v1 scoring)
- [ ] Lists UI: add/remove inline
- [ ] Subscriptions UI: service + region presets
- [x] Watch now deep-links on cards (when available)
- [ ] Public list sharing (PUBLIC only)
- [ ] Reuse GraphQL client/types (optional if we keep REST MVP)
- [ ] AI concierge UI (search bar augment + chat drawer) behind feature flag
- [ ] Friends' feed module and Friends' Picks toggle
- [ ] SEO improvements (next-seo, JSON-LD), PWA basics, a11y, i18n plan

Acceptance Criteria

- Users can search, paginate results, and see ratings/platforms
- Users can toggle theme and search from header across pages
- Picks render daily selection; lists/subscriptions editable inline
- AI concierge returns results or falls back to filter search; latency acceptable
- Social feed renders friend actions; public share URLs render OG and open correct route

Testing Strategy

- Unit: components (Thumb, Chip), hooks
- Integration: search filter + pagination, picks rendering
- Integration: chat drawer submit → results; feed fetch; share link generation
  - SEO meta present; PWA manifest; lighthouse a11y checks
- E2E (Playwright): search → add to list → verify; subscriptions → picks changes
  - Chat drawer → results with fallback; share → open new tab with OG meta
