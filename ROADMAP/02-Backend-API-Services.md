# Epic 2 — Backend API & Services (W4–W6)

Checklist

- [x] AuthN/AuthZ: JWT validation (gateway pre-handler), service-layer guardrails (optional)
- [x] Input validation (JSON schemas) for lists/items/alerts/subscriptions/feedback
- [x] Security headers & rate limiting (`@fastify/helmet`, `@fastify/rate-limit`, 429 Retry-After)
- [x] Picks v1 (rules-based) with reason strings, caching/invalidation
- [x] Search ranking tweak to soft-prefer images; score then year
- [x] Search service (GraphQL/REST → OpenSearch → availability join)
- [x] Lists & Feedback (CRUD; like/dislike/save updates vectors/cache)
- [x] Private Mode (request flag; skip writes/analytics)
- [ ] Deep links normalization + web fallback
- [ ] Picks scoring use profile subscriptions + popularity weights

Acceptance Criteria

- Contract tests pass for GraphQL and REST
- Coverage ≥ 80% on services/resolvers
- Picks P50 < 300ms locally (excluding cold cache)

Testing Strategy

- Unit
  - Scoring functions; reason string templating; JWT validators
  - Policy checks for RBAC/ABAC
- Integration
  - Picks endpoint: cache hit/miss; invalidation on feedback/preferences
  - Search with filters: joins availability and respects region/services
  - Lists/Feedback mutations: data persisted and vectors updated
- E2E
  - Auth → picks → feedback → picks refresh path returns updated results
