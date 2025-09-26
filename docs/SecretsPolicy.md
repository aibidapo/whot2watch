# Secrets Policy

This project uses local `.env` files for development and GitHub Actions Secrets for CI.

## Local Development (.env)

- Create a `.env` file from `.env.example` at the repo root.
- Do not commit `.env` to version control (already ignored).
- Common variables:
  - `DATABASE_URL` – Postgres connection string (local compose uses w2w/w2w)
  - `REDIS_URL` – Redis URL (local compose: `redis://localhost:6379`)
  - `OPENSEARCH_URL` – OpenSearch URL (local compose: `http://localhost:9200`)
  - Optional for real ingestion:
    - `TMDB_API_KEY` – TMDB v3 API key
    - `TMDB_ACCESS_TOKEN` – TMDB v4 Bearer token (preferred)

## CI / GitHub Actions

- Store secrets under: GitHub → Settings → Secrets and variables → Actions → New repository secret
- Recommended secrets:
  - `TMDB_API_KEY` – optional, for nightly real pipeline
  - `TMDB_ACCESS_TOKEN` – optional, for nightly real pipeline (preferred if both set)
- Service containers (Postgres/Redis/OpenSearch) run locally in the CI job; no cloud credentials required.

## Usage and Guardrails

- The ingestion worker prefers `TMDB_ACCESS_TOKEN` (v4). If neither v4 nor v3 key is present, it falls back to sample data for deterministic CI runs.
- Never hardcode or commit secrets; use environment variables and the `.env` loader.
- Rotate API keys periodically and revoke unused keys.
- For external contributors, CI runs without TMDB secrets and uses mocked/sample data.

## Incident Response

- If a secret is accidentally exposed:
  1. Revoke/rotate the key immediately at the provider (TMDB console).
  2. Remove the secret from any logs and force-push history rewrite only if strictly necessary.
  3. Update GitHub Actions secret with the new value.
  4. Open a brief incident note in the repo issues for traceability.

