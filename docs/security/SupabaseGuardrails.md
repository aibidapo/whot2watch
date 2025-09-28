# Supabase Guardrails — Risks & Controls

Scope: Using Supabase for managed Postgres + Auth (optional Realtime/Storage) while keeping Node API gateway as the single entry point.

Controls

- Gateway-only access
  - Clients must not call Supabase DB APIs directly.
  - All reads/writes go through the Node/Nest API; enforce via ESLint (ban supabase client imports in app code) and code review.
- JWT validation in gateway
  - Verify `iss/aud/exp/nbf` against Supabase JWK in the API gateway; reject on mismatch/expiry.
- RLS usage (optional, narrow)
  - Start deny-all; allow per-row by `auth.uid()` only for limited direct reads (e.g., admin tools).
  - Keep core authorization policies in gateway services.
- Portability
  - Migrations in-repo (Prisma/SQL). Avoid non-portable extensions unless clearly justified (add ADR); maintain a shadow Postgres in CI if needed.
- Secrets & keys
  - Never ship service-role keys to clients. Rotate keys regularly; store in secrets manager.
- Observability
  - Enable backups + PITR; log auth failures and policy denials; set alerting thresholds.

Example RLS (conceptual)

```sql
-- Deny by default
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_access ON lists FOR ALL TO PUBLIC USING (false);

-- Allow owner read/write
CREATE POLICY lists_owner_rw ON lists
  FOR ALL TO authenticated
  USING (owner_profile_id = auth.uid())
  WITH CHECK (owner_profile_id = auth.uid());
```

Checklist

- [ ] ESLint rule bans supabase client imports in app/gateway code
- [ ] Gateway verifies JWT via JWK (iss/aud/exp/nbf), logs failures
- [ ] RLS policies documented (deny-all baseline; owner-based checks)
- [ ] Migrations in-repo; ADRs for Supabase-specific features
