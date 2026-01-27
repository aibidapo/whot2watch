# Epic 2 — Backend API & Services (W2–W4)

Checklist

- [x] AuthN/AuthZ: JWT validation (gateway pre-handler), service-layer guardrails (optional)
- [x] Input validation (JSON schemas) for lists/items/alerts/subscriptions/feedback
- [x] Security headers & rate limiting (`@fastify/helmet`, `@fastify/rate-limit`, 429 Retry-After)
- [x] Picks v1 (rules-based) with reason strings, caching/invalidation
- [x] Search ranking tweak to soft-prefer images; score then year
- [x] Search service (GraphQL/REST → OpenSearch → availability join)
- [x] Lists & Feedback (CRUD; like/dislike/save updates vectors/cache)
- [x] Private Mode (request flag; skip writes/analytics)
- [x] Deep links normalization + web fallback
- [x] Picks scoring use profile subscriptions + popularity weights
- [x] Expose ratings and popularity in search and picks APIs
- [x] Analytics: `/analytics` endpoint + optional buffering/forwarding
- [x] Admin/on-demand refresh endpoints (by TMDB/IMDB id)
- [x] Affiliate link plumbing (feature-flagged) via deep-link builder
  - [x] Append UTM params when `AFFILIATES_ENABLED=true`; preserve original query
- [x] API versioning strategy (v1 prefix; backward compatibility policy)
- [x] Granular rate limits (per-user/endpoint/feature)
- [x] API caching strategy (Redis keys, TTLs, invalidation)
- [x] Docs portal: interactive OpenAPI (non-prod gated); SDK generation guidance (TBD)
- [x] API performance monitoring (APM routes, latency/error dashboards)

Acceptance Criteria

- Contract tests pass for GraphQL and REST
- Coverage ≥ 80% on services/resolvers
- Picks P50 < 300ms locally (excluding cold cache)
- Search endpoints return `ratings`, `popularity`, and nested `availability`
- Admin refresh populates missing external ids/ratings for a single title
- Affiliate flag off by default; when enabled, links include provider params and disclosure
- API responses available under `/v1/*`; deprecation window documented
- Rate limits enforced per-user and sensitive endpoints; 429 with Retry-After
- Cache hits visible in logs/metrics; invalidation occurs on related writes
- API latency and error rates tracked per endpoint with alerts on SLO breaches

Testing Strategy

- Unit
  - Scoring functions; reason string templating; JWT validators
  - Policy checks for RBAC/ABAC
  - Affiliate parameter builder appends correct params when flag is enabled
  - Versioned route helpers and rate-limit config units
- Integration
  - Picks endpoint: cache hit/miss; invalidation on feedback/preferences
  - Search with filters: joins availability and respects region/services
  - Lists/Feedback mutations: data persisted and vectors updated
  - Affiliate parameters appear on deep links when flag is enabled; absent when disabled
  - Versioned routes respond; rate limits enforced per user/endpoint
  - Cached endpoints return within target latency; writes invalidate related keys
- Contract tests: OpenAPI/GraphQL updated schemas include ratings/popularity
- E2E
  - Auth → picks → feedback → picks refresh path returns updated results
  - Admin refresh endpoint triggers title enrichment and reflects in search

Step-by-Step Implementation Plan (API Exposure for Ratings & Popularity)

1. Search API/Resolver Updates
   - Extend search DTO/GraphQL schema and REST OpenAPI to include:
     - `popularity` (float), `voteAverage` (float), `ratings` (object), `externalIds` (tmdb/imdb/trakt)
   - In search service, pass through the additional fields from OpenSearch docs
   - Ensure nested `availability` + derived facets remain unchanged

2. Picks Scoring Update
   - Incorporate `Title.popularity` and `voteAverage` as soft boosts
   - Add profile subscription alignment: boost titles available on user’s active services
   - Keep reason strings transparent (e.g., "Popular on TMDB", "On your subscriptions: NETFLIX")

3. Deep Link Normalization
   - Use `services/catalog/deeplink.ts` normalize function for consistent provider search links
   - Fallback: TMDB page URL when provider-specific deep link is unavailable

4. Admin/On-Demand Refresh Endpoints
   - REST endpoints:
     - `POST /v1/admin/refresh/tmdb/{tmdbId}`
     - `POST /v1/admin/refresh/imdb/{imdbId}`
   - Behavior: enqueue (or run) enrichment steps to fetch TMDB external_ids, providers, and OMDb ratings; update DB and return summary
   - Add RBAC guard (admin-only) and rate-limit

5. Affiliate Plumbing (Flagged)
   - Extend deep-link builder to append provider-specific affiliate params when `AFFILIATES_ENABLED` is true
   - Add disclosure and toggle; server-side controlled

6. Versioning, Limits & Caching
   - Prefix REST routes with `/v1`; document versioning and deprecation policy
   - Add per-user, per-endpoint rate limits for admin/AI/refresh endpoints
   - Introduce Redis caching for read-heavy endpoints (e.g., search with identical filters) with safe TTLs and invalidation on related writes

7. Docs Portal
   - Serve interactive OpenAPI (Redoc or Swagger UI) in non-prod; add SDK generation guidance

8. Contracts & Types
   - Update `Whot2Watch-docs/docs/rest/openapi.yaml` schemas for search/picks to include added fields
   - Regenerate types: `pnpm gen:openapi` and `pnpm gen:graphql`

Acceptance Criteria (Detailed)

- Search response objects include `popularity`, `voteAverage`, `ratings`, `externalIds`
- Picks responses leverage popularity/subscription weights with measurable boost in CTR during test runs
- Deep links resolve to provider search pages or TMDB fallback
- Admin refresh endpoints update a single title end-to-end (external IDs, providers, ratings) and reindex it
- When affiliates are enabled, outbound links include affiliate params and disclosure is present

Unit Tests (Additions)

- Search mapping/DTO serializers include ratings/popularity/externalIds
- Picks scoring utility respects subscription boosts and popularity weights
- Deep link utility returns expected URL for each provider and fallback
- Affiliate parameter builder appends correct params when flag is enabled
- Admin controller validates inputs and guards access

Integration Tests (Additions)

- Search endpoint returns enriched fields and supports availability filters
- Picks endpoint recomputes ranks when popularity changes
- Admin refresh endpoint triggers ingestion pipeline and updates index for the targeted title
- Affiliate parameters appear on deep links when flag is enabled; absent when disabled

E2E Tests (Additions)

- User with subscriptions queries picks/search → results include enriched fields and correct deep links
- Admin triggers refresh → user sees updated ratings/availability in subsequent search
- Affiliates flag on → outbound links include parameters and disclosure
