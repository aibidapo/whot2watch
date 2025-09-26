# Whot2Watch — Unified Docs Bundle (Functional + Security)

This bundle is the single source of truth for Whot2Watch MVP delivery.

Contents:

- `docs/ERD.md` — Mermaid ERD
- `docs/graphql/schema.graphql` — GraphQL API contract
- `docs/rest/openapi.yaml` — REST fallback (OpenAPI 3.0)
- `docs/analytics/events.md` — Analytics event catalog + JSON schema examples
- `src/analytics/tracking.ts` — TypeScript tracking helper
- **Security**
  - `SECURITY.md` — security policy
  - `docs/security/ThreatModel.md` — threat model (STRIDE-lite)
  - `docs/security/SecureCodingChecklist.md`
  - `docs/security/MobileHardening.md`
  - `server/security/expressSecurity.ts`, `server/security/graphqlEnvelop.ts`
  - `.semgrep.yml`, `.github/workflows/ci-security.yml`
  - `docs/security/SecureRoadmapAddendum.md`

> Branding note: All references updated to **Whot2Watch**. Folder path is **whot2watch-docs/**.
