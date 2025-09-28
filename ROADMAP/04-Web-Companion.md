# Epic 4 — Web Companion (Next.js lite) (W9–W10)

Checklist

- [x] Search page with filters (query, service, region) and pagination (Load more)
- [x] Trending now section from /search
- [x] Rating badge (yellow star) and platform chips
- [x] Theming (dark/light toggle), header search
- [x] Dev convenience script `pnpm dev:all`
- [ ] Picks page wired to backend (v1 scoring)
- [ ] Lists UI: add/remove inline
- [ ] Subscriptions UI: service + region presets
- [ ] Watch now deep-links on cards (when available)
- [ ] Public list sharing (PUBLIC only)
- [ ] Reuse GraphQL client/types (optional if we keep REST MVP)

Acceptance Criteria

- Users can search, paginate results, and see ratings/platforms
- Users can toggle theme and search from header across pages
- Picks render daily selection; lists/subscriptions editable inline

Testing Strategy

- Unit: components (Thumb, Chip), hooks
- Integration: search filter + pagination, picks rendering
- E2E (Playwright): search → add to list → verify; subscriptions → picks changes
