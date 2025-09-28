# Epic 0 — Foundations, Repo, Quality Gates (W1–W2)

Checklist

- [x] Enforce local Python venv for all workflows (preflight + Husky)
- [x] Security CI (Semgrep OWASP on PRs)
- [x] Contracts validated (OpenAPI, GraphQL, Mermaid)
- [x] OpenAPI Spectral polish
  - [x] info.description, operationIds, tags, endpoint descriptions
  - [x] Define global tags in OpenAPI root
- [x] Align pnpm version warning (packageManager vs installed)
- [x] Types codegen from contracts (run in CI)
- [x] Secrets policy/tooling (enforce in CONTRIBUTING and CI docs)
- [x] Observability scaffolding (logger + request-id; Sentry placeholders later)
- [x] Ingestion environment wiring: .env keys, flags, schedules
- [ ] Minimal Redis-backed HTTP cache/backoff utility adopted across sources
- [ ] Secrets management (provider: Vault/SOPS or GH Environments) and rotation plan
- [ ] Monitoring & alerting: APM, logs aggregation, error taxonomy dashboards
- [ ] CI/CD: deployment automation with rollback notes; staging/prod env strategy

Governance & Ownership

- [ ] NERS for: `apps/mobile`, `apps/web`, `services/api`, `packages/ui`, `packages/types`, `Whot2Watch-docs`
- [x] PR template with checklist: contracts changed? tests added? naming follows Glossary? no TODOs? no duplicate logic?
- [x] ADRs directory `docs/adr/` with template; new modules/patterns must include ADR
- [x] Branch protection policy documented (require CI + 1 owner review; dismiss stale approvals)

Contracts & Types (anti-drift)

- [ ] ESLint rule to enforce imports from `packages/types/*`; ban hand-rolled DTOs and deep-imports
- [ ] Contract smoke tests (GraphQL introspection in non-prod; REST schema validation)

Code Hygiene

- [x] TS flags: enable `exactOptionalPropertyTypes`, `noImplicitOverride`
- [x] ESLint ban TODO/FIXME via `no-warning-comments` (OpenAPI Spectral `no-todos` as well)
- [x] Naming: `@typescript-eslint/naming-convention`; optional `cspell` in CI

Architecture Boundaries

- [x] dependency-cruiser (or eslint-plugin-boundaries) config to forbid cycles and enforce layering (apps → packages; services → packages; packages → no apps)
- [x] No deep imports: enforce barrel-only via `no-restricted-imports`

Duplication & Dead Code

- [x] Unify duplication threshold (3% or 5%) and fail builds when exceeded
- [x] Dead-code check (`knip` or `ts-prune`) added to CI

Naming & Ubiquitous Language

- [ ] `docs/Glossary.md` with canonical domain terms (Title, Availability, Provider, Region, Pick, List, Friend, GroupSession)
- [ ] PRs reference glossary for new exports; optional ESLint regex to flag banned aliases

Tests, Coverage & Mutation

- [ ] Negative tests matrix: authZ denials, bad input rejects, rate-limit 429s, GraphQL depth/cost rejections
- [ ] Mutation testing (`stryker`) on scoring/auth policy (nightly)

Data Model & Migrations

- [x] Prisma schema + initial migrations matching ERD
- [x] CI schema drift check (`prisma migrate diff`)
- [ ] Migrations for `imdbId`, `traktId`, `popularity`, `ExternalRating`, `TrendingSignal`, availability unique index

Dependency & Tooling Health

- [ ] Renovate (weekly) with safe automerge for dev deps; manual for prod deps
- [ ] `npm audit` (prod) or Snyk in CI; fail on criticals unless risk-accepted

 Monorepo Layout (prep)

- [x] Establish `apps/`, `services/`, `packages/` structure before boundary rules

Acceptance Criteria

- `pnpm qa` green locally and on main
- Contracts free of TODOs; GraphQL lints pass; OpenAPI Spectral warnings triaged
- Venv required to run any repo script (blocked if inactive)
- `.env` contains documented keys; ingestion scripts read them via `scripts/load-env.cjs`
- Feature flags exist (e.g., `AVAILABILITY_SOURCE`) and default to TMDB
- Cron schedules added in CI for nightly/hourly/weekly ingestion tasks
- Secrets never logged; redaction verified; rotation documented
- Staging/prod deployment paths documented with rollback steps

CI Steps (to be added)

- Add NERS and PR template; enforce branch protection in repo settings
- Add ESLint `no-restricted-imports` for `packages/types/*` and ban deep imports; add `no-warning-comments`
- Add Spectral custom rule `no-todos` for OpenAPI
- Add dependency-cruiser (or boundaries) validate step in CI
- Add dead code check (`knip`) step in CI
- Add GraphQL/REST contract smoke tests to CI
- Add Renovate bot; add `npm audit` (prod) or Snyk step

Testing Strategy

- Unit
  - Preflight venv script: rejects when `VIRTUAL_ENV` absent/misaligned; allows in CI
  - Script path updates (tsconfig, vitest): include correct dirs
  - HTTP cache/backoff behavior: retries on 5xx/429, respects TTLs, circuit breaker trips and heals
- Integration
  - `pnpm contracts:check` succeeds on clean clone
  - Husky hooks block without venv
  - Ingestion scripts load `.env` via `scripts/load-env.cjs` and access keys
- E2E
  - Fresh clone → `pnpm install` → activate venv → `pnpm qa` passes
  - Nightly CI sim run executes ingestion schedules without secrets leakage; logs redact keys
