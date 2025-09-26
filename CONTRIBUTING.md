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

## Hooks

Husky installs pre-commit (format, lint, typecheck) and pre-push (contracts + coverage) hooks during `pnpm install`. Use `HUSKY=0` to bypass in emergencies, but re-run the commands manually before pushing.
