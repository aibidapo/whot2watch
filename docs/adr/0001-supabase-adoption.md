# ADR-0001: Supabase Adoption for Managed Postgres + Auth

Status: Proposed

Context

- We need fast MVP delivery with Postgres + OIDC auth.
- Supabase offers managed Postgres, Auth (JWT), Realtime, Storage.

Decision

- Adopt Supabase for managed Postgres + Auth (dev/staging), keeping Node API gateway and workers unchanged.
- Clients will not talk directly to DB; gateway-only.

Consequences

- Faster delivery; minimal lock-in by keeping business logic in gateway and migrations in-repo.
- Optional Supabase-specific features (Realtime/Storage) must be documented in ADRs.

