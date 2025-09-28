# GraphQL Hardening

- Disable introspection in production.
- Apply depth and cost limits (e.g., depth ≤ 8; cost ≤ 1000).
- Prefer persisted/whitelist queries for public endpoints.
- Validate inputs; avoid dynamic resolvers; sanitize logging.
