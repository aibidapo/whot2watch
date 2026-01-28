# SOC 2 Lite Compliance Checklist

Lightweight compliance checklist aligned with SOC 2 Trust Service Criteria. This is not a formal SOC 2 audit but tracks the controls Whot2Watch implements.

## CC6 — Security

| Control | Status | Implementation |
|---------|--------|---------------|
| Authentication required for API access | Done | Auth0 JWT verification (`server/api.ts`) |
| Rate limiting | Done | `@fastify/rate-limit` — 100 req/min per IP; chat-specific limits |
| HTTP security headers | Done | `@fastify/helmet` (CSP, HSTS, X-Frame-Options, etc.) |
| CORS strict origin policy | Done | `CORS_ALLOWED_ORIGINS` allowlist (`server/api.ts`) |
| HPP protection | Done | `server/security/hpp.ts` — collapse duplicate query params |
| GraphQL hardening | Done | Depth limit (8), cost limit (1000), introspection disabled in prod |
| Encryption in transit | Done | HTTPS enforced in production |
| Secrets management | Done | `.env.local` excluded from Git; `gitleaks` in CI |
| Secret scanning | Done | `gitleaks` runs on every CI build |
| Dependency scanning | Done | `npm audit --prod --audit-level=critical` in CI |
| Static analysis | Done | Semgrep in `ci-security.yml`; ESLint strict mode |
| DAST scanning | Done | ZAP baseline scan weekly in CI (`ci-security.yml`) |
| Sensitive data redaction in logs | Done | Logger auto-redacts auth, token, secret, password keys |

## A1 — Availability

| Control | Status | Implementation |
|---------|--------|---------------|
| Health check endpoint | Done | `GET /healthz` returns DB + Redis + OpenSearch status |
| APM / observability | Done | `server/apm/middleware.ts` — per-route latency, error rates |
| SLO definitions | Done | `docs/SLO.md` — 99.5% availability, P95 latency targets |
| Disaster recovery plan | Done | `docs/DisasterRecovery.md` — RTO 1h, RPO 1h |
| Operational runbooks | Done | `docs/runbooks/` — error rate, latency, DB, external API |
| Rollback capability | Done | Immutable deployments; `git revert` + redeploy |
| Graceful degradation | Done | Redis, OpenSearch optional; MCP backoff; LLM fallback chain |
| Load testing | Done | k6 smoke/load/stress/chat scenarios; smoke runs in CI |

## PI1 — Processing Integrity

| Control | Status | Implementation |
|---------|--------|---------------|
| API contracts (source of truth) | Done | OpenAPI + GraphQL schema in `Whot2Watch-docs/` |
| Contract validation in CI | Done | `pnpm contracts:check`; GraphQL breaking change detection |
| TypeScript strict mode | Done | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Test coverage ≥ 80% | Done | Vitest coverage enforced in CI |
| Schema drift detection | Done | `prisma migrate diff` in CI pipeline |
| Mutation testing | Done | Stryker nightly (`nightly-mutation.yml`) |
| Code duplication check | Done | `jscpd` in QA gate |

## C1 — Confidentiality

| Control | Status | Implementation |
|---------|--------|---------------|
| GDPR data export | Done | `POST /v1/admin/gdpr/export/:userId` (`server/privacy/service.ts`) |
| GDPR data deletion | Done | `DELETE /v1/admin/gdpr/delete/:userId` |
| Data retention policies | Done | Configurable per entity type (`DATA_RETENTION_*` env vars) |
| Private Mode | Done | Suppresses analytics collection per profile |
| CORS origin restriction | Done | Only allowed origins can make cross-origin requests |
| API key gating (B2B) | Done | `PUBLIC_API_KEYS` for partner access |

## P1–P8 — Privacy

| Control | Status | Implementation |
|---------|--------|---------------|
| P1: Privacy notice | Done | Consent tracking in profile settings |
| P2: Choice and consent | Done | Opt-in/out for analytics, notifications |
| P3: Collection limitation | Done | Only collect data needed for recommendations |
| P4: Use/retention/disposal | Done | Retention policies auto-enforce via `enforceRetentionPolicy()` |
| P5: Access | Done | Users can export their data (GDPR export) |
| P6: Disclosure | Done | Affiliate disclosure text configurable |
| P7: Quality | Done | Data validation at API boundaries; TypeScript strict mode |
| P8: Monitoring | Done | Analytics validation (`server/analytics/validator.ts`); APM monitoring |
