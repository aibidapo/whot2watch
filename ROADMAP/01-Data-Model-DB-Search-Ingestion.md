# Epic 1 — Data Model, DB, Search, Ingestion (W1–W2)

Checklist

- [x] Postgres + migrations (Prisma)
  - [x] Tables: users, profiles, subscriptions, titles, availability, lists, list_items, feedback, recommendations, alerts
  - [x] Index strategy for title, region, service, profile_id
- [x] Redis cache (picks per profile/day; invalidation)
- [x] OpenSearch index (schema, analyzers)
- [x] Ingestion worker (TMDB, availability provider, aliasing)
  - [x] Multi-page ingest (TMDB_PAGES)
  - [x] Poster/backdrop URLs + voteAverage
- [x] Seed initial titles; schedule refresh (6–12h)
- [x] CI pipeline-smoke (mocked) on PR; nightly real pipeline with TMDB
- [x] Deep-link normalization utility integrated into Picks

—

Planned Enhancements (TMDB + OMDb + Trakt)

- [x] Title external IDs and popularity fields (`imdbId`, `traktId`, `popularity`) — popularity added
- [x] External ratings table (IMDB, RottenTomatoes, Metacritic)
- [ ] Trending signals table (TMDB, Trakt; day/week)
- [ ] TMDB external_ids + watch providers ingestion (normalize availability)
- [x] OMDb ratings enrichment by `imdbId`
- [ ] Trakt trending enrichment and optional fused popularity
- [x] OpenSearch mapping updates for `ratings` and `popularity`
- [ ] Data quality pipeline (validation, cleaning, quality metrics)
- [ ] Data privacy: retention policy, export/delete endpoints
- [ ] Performance optimization: DB indexing, query optimization

Step-by-Step Implementation Plan

1. Prisma Schema & Migrations
   - Add to `Title`: `imdbId String? @unique`, `traktId Int? @unique`, `popularity Float?`
   - Create `ExternalRating`:
     - Columns: `id`, `titleId`, `source` ('IMDB'|'ROTTEN_TOMATOES'|'METACRITIC'), `valueText`, `valueNum?`, `updatedAt`
     - Unique: `(titleId, source)`
   - Create `TrendingSignal`:
     - Columns: `id`, `titleId`, `source` ('TMDB'|'TRAKT'), `rank`, `window` ('day'|'week'), `capturedAt`
     - Unique: `(titleId, source, window)`
   - Add unique composite index on `Availability(titleId, service, region, offerType)`
   - Run: `pnpm prisma:migrate:dev` locally; `pnpm prisma:migrate:deploy` in CI

2. TMDB Ingestion Enhancements
   - Extend `services/catalog/tmdb.js`:
     - Capture `result.popularity` into normalized title
     - Add helpers: `fetchExternalIds(mediaType, tmdbId)`, `fetchProviders(mediaType, tmdbId)`
   - Update `services/catalog/worker.ingest.js` flow:
     - Fetch trending (movies + tv) with pages from `TMDB_PAGES`
     - For each title: upsert `Title` with `voteAverage`, `popularity`, images
     - Fetch and set `imdbId` via TMDB `external_ids` if missing
     - Fetch providers for `DEFAULT_REGION` (and optional allowlist), map names via `providerAlias`, map offer types, compute `deepLink` via `deeplink.normalizeDeepLink`
     - Upsert `Availability` rows with `lastSeenAt=now()` (idempotent via composite unique)
     - Insert/Upsert `TrendingSignal` for TMDB (`window='week'`, `rank` by list position)

3. OMDb Ratings Enrichment
   - Add `services/catalog/omdb.js` (CJS) with `fetchOmdbByImdb(imdbId)` and `mapOmdbRatings(r)`
   - Create `services/catalog/ingestOmdbRatings.js`:
     - Select titles with `imdbId` where ratings are stale or missing
     - Fetch OMDb; upsert `ExternalRating` per source with `valueText` and parsed `valueNum`
     - Cache responses in Redis for 7 days

4. Trakt Trending Enrichment
   - Add `services/catalog/trakt.js` (CJS) with trending fetchers and headers (`trakt-api-key`, version=2)
   - Create `services/catalog/ingestTraktTrending.js`:
     - For each trending item, map by `imdbId` where possible, else name+year fallback
     - Upsert `TrendingSignal` with `source='TRAKT'`, `window` ('day' or 'week')
     - Optional: compute fused popularity (e.g., z-score combine) and write to `Title.popularity`

5. OpenSearch Mapping & Indexing
   - Extend `services/catalog/mappings.js` to include `ratings` object/flattened and ensure `popularity` exists
   - Update `services/catalog/indexFromDb.js` → `toIndexedDoc` to emit:
     - `tmdbId`, `popularity`, `ratings` aggregated from `ExternalRating`
     - Keep `availability` nested and the derived facets (`availabilityServices`, `availabilityRegions`)
   - Reindex: `pnpm index:fromdb`

6. Config, Flags, Scheduling
   - `.env` keys:
     - `TMDB_API_KEY` or `TMDB_ACCESS_TOKEN`, `OMDB_API_KEY`, `TRAKT_CLIENT_ID`, `DEFAULT_REGION`, optional OAuth vars for Trakt later
     - `AVAILABILITY_SOURCE=TMDB` (future: WATCHMODE/JUSTWATCH)
   - Scripts:
     - `ingest:tmdb` (existing), `ingest:omdb`, `ingest:trakt`, `index:fromdb`, `pipeline:ingest-index`
   - CI (cron):
     - Nightly: TMDB trending+providers → index
     - Hourly: Trakt trending
     - Weekly: OMDb ratings refresh

7. HTTP Caching, Backoff, Resilience
   - Add small HTTP helper wrapping `fetch` with Redis GET cache, exponential backoff on 429/5xx, and simple per-host circuit breaker
   - Use in TMDB/OMDb/Trakt modules

Acceptance Criteria

- Prisma migrations apply cleanly; ERD parity documented
- `Title` rows include `tmdbId`, optional `imdbId`, `traktId`, and `popularity`
- `Availability` populated via TMDB providers for `DEFAULT_REGION` with correct `offerType` and `deepLink`
- `ExternalRating` rows persist IMDB/RottenTomatoes/Metacritic (≥60% coverage of titles with `imdbId`)
- `TrendingSignal` rows present for TMDB (week) and Trakt (day/week)
- OpenSearch docs include `popularity`, `ratings`, nested `availability`, and derived facets
- Nightly/hourly/weekly schedules run green in CI and index contains ≥1 doc

Testing Strategy

- Unit
  - Prisma schema compiles; seed consistency
  - Provider alias mapping; offer-type mapping; deeplink normalization
  - OMDb ratings parsing to `valueText`/`valueNum`
- Integration
  - TMDB ingest creates/updates `Title`, `Availability`, `TrendingSignal`
  - OMDb script backfills `ExternalRating` for titles with `imdbId`
  - Trakt script writes `TrendingSignal` and (optionally) updates `Title.popularity`
  - `indexFromDb` produces docs with `ratings`, `popularity`, expected availability facets
- E2E
  - `docker-compose up` → run ingest scripts → `indexFromDb` → OpenSearch `/_search` shows fields populated; latency within expected bounds

Rollout Order (Week 1)

- Day 1: Migrations; persist TMDB `popularity`; reindex
- Day 2: TMDB external_ids + providers → real availability; deep links
- Day 3: OMDb ratings ingest; index `ratings`
- Day 4: Trakt trending; optional fused popularity; expose in picks/search
- Day 5: Caching/backoff; CI schedules; add tests/dashboards
