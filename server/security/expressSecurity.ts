/**
 * This project uses Fastify, not Express.
 *
 * Security middleware is applied in `server/api.ts` via:
 * - `@fastify/cors` — strict origin allowlist (CORS_ALLOWED_ORIGINS)
 * - `@fastify/helmet` — HTTP security headers
 * - `@fastify/rate-limit` — per-IP request throttling
 * - `server/security/hpp.ts` — HTTP Parameter Pollution protection
 * - `server/security/graphqlEnvelop.ts` — GraphQL depth/cost limits, introspection control
 */
