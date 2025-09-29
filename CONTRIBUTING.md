# Contributing

## Commands

- Activate the Python venv first (mandatory):
  - PowerShell: `.\\.venv\\Scripts\\Activate.ps1` (or `.\\whot2watch_venv\\Scripts\\Activate.ps1`)
  - bash/zsh: `source .venv/bin/activate` (or `source whot2watch_venv/bin/activate`)
- `pnpm qa` – run all quality gates locally.
- `pnpm contracts:check` – validate OpenAPI, Spectral rules, GraphQL schema, and Mermaid ERD.
- `pnpm test:ci` – run tests without watch mode.
- `pnpm coverage` – run tests with coverage thresholds enforced (80%).
- `pnpm gen:graphql` – generate GraphQL TypeScript types from schema
- `pnpm gen:openapi` – generate OpenAPI TypeScript types

## Contracts

- REST: edit `Whot2Watch-docs/docs/rest/openapi.yaml`. Remove any TODO markers before opening a PR.
- GraphQL: edit `Whot2Watch-docs/docs/graphql/schema.graphql`. Ensure the schema linter passes (no TODOs, descriptions in place).
- ERD: edit `Whot2Watch-docs/docs/ERD.mmd`. The diagram must render via Mermaid CLI.

## Secrets

- Follow `docs/SecretsPolicy.md`. Use `.env` locally and a secrets manager in CI/Cloud.

## Quality Gates

- ESLint (`pnpm lint`) must succeed with zero warnings.
- Prettier (`pnpm format:check`) enforces formatting.
- TypeScript (`pnpm typecheck`) prevents type regressions.
- Vitest coverage (`pnpm coverage`) maintains = 80% for lines/branches/functions/statements.
- jscpd (`pnpm qa:jscpd`) keeps duplication below 5%.
- Gitleaks (`pnpm qa:gitleaks`) scans for secrets before merge.

## CI Pipelines

- Manual run of full CI (including pipeline-smoke):
  - In GitHub, go to Actions → "ci" workflow → "Run workflow" → select branch → "Run workflow".
  - This triggers the standard CI plus the pipeline-smoke job that spins up Postgres/Redis/OpenSearch, runs mocked ingestion, indexes from DB, and asserts indexed documents > 0.

- Nightly real pipeline:
  - Actions → "nightly-pipeline" → "Run workflow" to run on demand, or wait for the scheduled daily cron.
  - If `TMDB_API_KEY`/`TMDB_ACCESS_TOKEN` GitHub secrets are set, the worker uses real TMDB; otherwise it falls back to sample data.

## Local Development & Pipeline Smoke

Prereqs: Docker Desktop, Node.js 20, pnpm, Python venv activated.

1. Start local services

- `docker compose up -d postgres redis opensearch dashboards`
- OpenSearch: `http://localhost:9200` (security disabled). Dashboards: `http://localhost:5601`.

2. Environment

- Copy `.env.example` to `.env` and fill values as needed.
- Minimum for local: `DATABASE_URL`, `REDIS_URL`, `OPENSEARCH_URL`.
- Optional: `TMDB_API_KEY` (v3) or `TMDB_ACCESS_TOKEN` (v4) to use real TMDB.
- Optional analytics forwarding: set `ANALYTICS_WEBHOOK_URL` (and optional `ANALYTICS_TOKEN`). When present, the API forwards `/analytics` events to this endpoint; otherwise they are logged locally. Private Mode suppresses sends.
- Optional analytics buffering (retry/background flush):
  - `ANALYTICS_BUFFER=true` to enable
  - `ANALYTICS_BUFFER_INTERVAL_MS=5000` flush interval (ms)
  - `ANALYTICS_BUFFER_MAX=50` max batch size per flush
  - Behavior: events are queued (Redis-backed when available, in-memory fallback) and flushed periodically; failures are requeued to preserve order.

- Optional affiliate UTM parameters on Watch Now links:
  - `AFFILIATES_ENABLED=true` to append `utm_source=whot2watch&utm_medium=affiliate&utm_campaign=watch_now` (and `utm_content=<service>`)
  - Disabled by default; original query params are preserved

3. DB setup

- `pnpm prisma:generate`
- `pnpm prisma:migrate:deploy`
- `pnpm db:seed`

4. Run pipeline smoke locally

- Mocked (no TMDB creds required; fallback sample used):
  - `pnpm pipeline:ingest-index`
- Real TMDB (requires creds in `.env`):
  - `pnpm worker:ingest`
  - `pnpm index:fromdb`

5. Verify indexing

- `curl http://localhost:9200/titles/_count` → `{"count":N}` with N > 0
- In Dashboards (Data Views), add fields `availabilityServices` and `availabilityRegions` to filter and visualize.

6. Run API locally

- `pnpm api:dev` then visit `http://localhost:4000/` (test UI) or call `/search`.

Troubleshooting (PowerShell)

- `curl` is an alias for `Invoke-WebRequest`. Prefer `Invoke-RestMethod` for JSON:
  - `Invoke-RestMethod -Method GET http://localhost:9200/titles/_count`

## Auth / JWT (optional)

- To require JWT auth for mutating routes, set in `.env` (and restart):
  - `REQUIRE_AUTH=true`
  - `JWT_ISSUER=...`
  - `JWT_AUDIENCE=...`
  - `JWKS_URI=https://<your-auth-domain>/.well-known/jwks.json`
- When enabled, requests must send `Authorization: Bearer <token>`.

## Hooks

Husky installs pre-commit (format, lint, typecheck) and pre-push (contracts + coverage) hooks during `pnpm install`. Use `HUSKY=0` to bypass in emergencies, but re-run the commands manually before pushing.
