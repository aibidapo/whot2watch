# Epic 1 — Data Model, DB, Search, Ingestion (W2–W4)

Checklist

- [x] Postgres + migrations (Prisma)
  - [x] Tables: users, profiles, subscriptions, titles, availability, lists, list_items, feedback, recommendations, alerts
  - [x] Index strategy for title, region, service, profile_id
- [x] Redis cache (picks per profile/day; invalidation)
- [x] OpenSearch index (schema, analyzers)
- [x] Ingestion worker (TMDB, availability provider, aliasing)
- [x] Seed initial titles; schedule refresh (6–12h)
- [x] CI pipeline-smoke (mocked) on PR; nightly real pipeline with TMDB

Acceptance Criteria

- ERD parity with DB; Prisma migrations applied without errors
- Title search returns relevant results; availability exists for day‑1 services/regions

Testing Strategy

- Unit
  - Prisma schema validates; seed scripts are idempotent
  - Provider alias mapping normalizes inputs
- Integration
  - Ingestion run populates titles and availability; indexes built
  - Search query returns items with expected fields
- E2E
  - Local compose (postgres, redis, opensearch) up → ingestion → search returns results within expected latency

