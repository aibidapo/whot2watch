/**
 * Public API Key Gate — Epic 9: B2B Readiness
 *
 * Simple API key validation via X-API-Key header.
 * Keys configured via PUBLIC_API_KEYS env var (comma-separated).
 * Rate limit: 100 req/min (handled by Fastify global rate limiter).
 * Read-only: only allowed on specific public endpoints.
 */

function getValidKeys(): Set<string> {
  const raw = process.env.PUBLIC_API_KEYS || '';
  if (!raw.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

/**
 * Fastify preHandler that validates X-API-Key header.
 * If PUBLIC_API_KEYS is empty, this is a no-op (open access).
 */
export async function apiKeyGate(request: any, reply: any) {
  const validKeys = getValidKeys();
  // If no keys configured, allow open access
  if (validKeys.size === 0) return;

  const apiKey = String(request.headers?.['x-api-key'] || '').trim();
  if (!apiKey || !validKeys.has(apiKey)) {
    reply.code(401).send({
      error: 'INVALID_API_KEY',
      message: 'A valid X-API-Key header is required.',
    });
    return;
  }
}

/**
 * Check if public API keys are configured.
 */
export function hasApiKeys(): boolean {
  return getValidKeys().size > 0;
}
