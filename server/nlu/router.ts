/**
 * NLU Parse API Router
 * Epic 8: AI & Social — Search bar NLU augment
 *
 * GET /nlu/parse?q=<query> — Parse natural-language query into structured entities
 *
 * Accessible via /v1/nlu/parse through the version proxy in api.ts.
 * Feature-flag gated: returns 503 when NLU_ENABLED=false
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { isNLUEnabled } from "../agents/config";
import { extractEntities, stripEntities } from "../agents/nlu";

export default async function nluRouter(app: FastifyInstance): Promise<void> {
  app.get(
    "/nlu/parse",
    async (
      request: FastifyRequest<{
        Querystring: { q?: string };
      }>,
      reply: FastifyReply
    ) => {
      if (!isNLUEnabled()) {
        return reply.status(503).send({
          error: "NLU is currently disabled",
          code: "NLU_DISABLED",
        });
      }

      const query = request.query as Record<string, string | undefined>;
      const q = query.q;

      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return reply.status(400).send({
          error: "q query parameter is required",
          code: "INVALID_REQUEST",
        });
      }

      const entities = extractEntities(q);
      const cleanQuery = stripEntities(q);

      return reply.status(200).send({
        originalQuery: q,
        cleanQuery,
        entities,
      });
    }
  );
}
