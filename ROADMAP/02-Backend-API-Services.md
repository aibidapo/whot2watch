# Epic 2 — Backend API & Services (W4–W6)

Checklist

- [ ] AuthN/AuthZ: OIDC (PKCE), JWT validation, service-layer policies
- [ ] Picks v1 (rules-based) with reason strings, caching/invalidation
- [ ] Search service (GraphQL/REST → OpenSearch → availability join)
- [ ] Lists & Feedback (CRUD; like/dislike/save updates vectors/cache)
- [ ] Private Mode (request flag; skip writes/analytics)
- [ ] Deep links normalization + web fallback

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

