# Epic 6 — Testing, Performance, Security, Privacy (W10–W12)

Checklist

- [x] Unit + integration (services/resolvers)
- [x] Contract tests (GraphQL/REST)
- [x] Mobile E2E (Detox) critical flows — DEFERRED: blocked by Epic 3 (mobile app not built)
- [x] Performance passes (cache, indexes, load tests P95 < 600ms)
- [x] Security & privacy (rate limiting, HPP, Helmet, strict CORS; GraphQL hardening; data export/deletion; secrets in vault)
- [x] Reliability & monitoring (dashboards, runbooks, SLO 99.5%)
- [x] Ingestion pipeline E2E tests (TMDB→DB→OpenSearch, OMDb/Trakt enrichment)
- [x] Security testing: ZAP scan on staging, Semgrep in CI, dep scan
- [x] Load/stress testing: k6/Artillery scenarios and capacity planning
- [x] Disaster recovery: backups, snapshots, restoration drills
- [x] Compliance prep: privacy by design, basic SOC2-lite checklist

Acceptance Criteria

- [x] Coverage ≥ 80% (lines/branches/functions/statements) — enforced by `pnpm coverage`
- Load tests meet P95 < 600ms for picks/search
- Data export/deletion flows functional; Private Mode suppression verified
- Dashboards live; alerting thresholds set
- Ingestion E2E: after scheduled runs, OpenSearch docs contain `popularity`, `ratings`, and nested `availability` with expected freshness
- CI scheduled jobs (nightly/hourly/weekly) complete successfully

Testing Strategy

- Unit: core helpers, policies, validators
- Integration: contract tests against running API (GraphQL/REST), rate-limits enforced
- E2E: mobile flows, privacy flows, failure injection scenarios
- Ingestion Pipeline Tests:
  - Unit
    - TMDB provider normalization (offer type mapping); deeplink normalization
    - OMDb ratings parser (text→numeric) and source mapping
    - Trakt trending mapper (ids, window handling)
  - Integration
    - TMDB ingest creates `Title` with `popularity` and fills `Availability`; TMDB `TrendingSignal` rows created
    - OMDb job backfills `ExternalRating` for titles with `imdbId`
    - Trakt job writes `TrendingSignal` and (optionally) updates `Title.popularity`
    - `indexFromDb` includes `ratings`, `popularity`, facets; search filters on nested `availability` succeed
  - E2E
    - Bring up `docker-compose`; run TMDB ingest + index; query OpenSearch for enriched docs
    - Run OMDb job; verify ratings appear in search; run Trakt job; verify popularity impacts ranking
    - Verify schedules: simulate cron run in CI and assert indexed doc count ≥ 1

Open Items / Temporary Exceptions

- [x] JWT verification tests: stabilize Vitest mocking for `jsonwebtoken`/`jwks-rsa` and remove temporary coverage exclude for `server/security/**`.
