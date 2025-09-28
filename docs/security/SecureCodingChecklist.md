# Secure Coding Checklist — Whot2Watch

- Validate inputs on all boundaries
- Use parameterized queries (no raw string SQL)
- Enforce authorization checks on every resolver/route
- Apply GraphQL depth/cost limits and disable introspection in prod
- Add Helmet, strict CORS, HSTS, and a CSP
- Do not log secrets/tokens/PII; use redaction
- Prefer allowlists for outbound calls and CORS
- Handle errors with generic messages; details only in server logs
- Keep dependencies updated and audited
