# Epic 6 — Testing, Performance, Security, Privacy (W10–W12)

Checklist


- [x] Unit + integration (services/resolvers)
- [x] Contract tests (GraphQL/REST)
- [ ] Mobile E2E (Detox) critical flows
- [ ] Performance passes (cache, indexes, load tests P95 < 600ms)
- [ ] Security & privacy (rate limiting, HPP, Helmet, strict CORS; GraphQL hardening; data export/deletion; secrets in vault)
- [ ] Reliability & monitoring (dashboards, runbooks, SLO 99.5%)

Acceptance Criteria

- [x] Coverage ≥ 80% (lines/branches/functions/statements) — enforced by `pnpm coverage`
- Load tests meet P95 < 600ms for picks/search
- Data export/deletion flows functional; Private Mode suppression verified
- Dashboards live; alerting thresholds set

Testing Strategy

- Unit: core helpers, policies, validators
- Integration: contract tests against running API (GraphQL/REST), rate-limits enforced
- E2E: mobile flows, privacy flows, failure injection scenarios

Open Items / Temporary Exceptions

- [x] JWT verification tests: stabilize Vitest mocking for `jsonwebtoken`/`jwks-rsa` and remove temporary coverage exclude for `server/security/**`.

