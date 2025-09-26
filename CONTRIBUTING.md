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

## Hooks

Husky installs pre-commit (format, lint, typecheck) and pre-push (contracts + coverage) hooks during `pnpm install`. Use `HUSKY=0` to bypass in emergencies, but re-run the commands manually before pushing.
