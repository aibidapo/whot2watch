/**
 * Chat API Router
 * Epic 2/8: REST + SSE endpoints for AI Concierge
 *
 * POST /chat       — Send a chat message, receive recommendations
 * GET  /chat/stream — SSE streaming (server-sent events)
 * DELETE /chat/:sessionId — End a chat session
 *
 * Accessible via /v1/chat through the version proxy in api.ts.
 *
 * Feature-flag gated: returns 503 when AI_CONCIERGE_ENABLED=false
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  OrchestratorInput,
  RedisLike,
} from "../agents/types";
import { isAIConciergeEnabled } from "../agents/config";
import { orchestrate, type OrchestratorDeps } from "../agents/orchestrator";
import { getChatSessionManager, resetChatSessionManager, type ChatSessionManagerOptions } from "./session";
import type { MCPClient } from "../mcp/client";
import { createLogger } from "../common/logger";

const logger = createLogger("chat-router");

// ============================================================================
// Plugin Options
// ============================================================================

export interface ChatRouterOptions {
  prisma: PrismaClient;
  mcpClient?: MCPClient;
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Lazily reads Redis from the Fastify instance.
 * Redis is attached in the app's onReady hook, so it may not be available
 * at plugin registration time. Each request handler reads it at call time.
 */
function getRedis(app: FastifyInstance): RedisLike | undefined {
  const redis = (app as unknown as Record<string, unknown>).redis;
  if (!redis) return undefined;
  return redis as RedisLike;
}

export default async function chatRouter(
  app: FastifyInstance,
  options: ChatRouterOptions
): Promise<void> {
  const { prisma, mcpClient } = options;

  function buildDeps(): OrchestratorDeps {
    const deps: OrchestratorDeps = { prisma };
    const redisDep = getRedis(app);
    if (redisDep) deps.redis = redisDep;
    if (mcpClient) deps.mcpClient = mcpClient;
    return deps;
  }

  // --------------------------------------------------------------------------
  // POST /v1/chat — Synchronous chat message
  // --------------------------------------------------------------------------

  app.post(
    "/chat",
    async (
      request: FastifyRequest<{ Body: ChatRequest }>,
      reply: FastifyReply
    ) => {
      // Feature flag gate
      if (!isAIConciergeEnabled()) {
        return reply.status(503).send({
          error: "AI Concierge is currently disabled",
          code: "CONCIERGE_DISABLED",
        });
      }

      const body = request.body as ChatRequest | undefined;
      if (!body || !body.message || typeof body.message !== "string") {
        return reply.status(400).send({
          error: "message is required and must be a string",
          code: "INVALID_REQUEST",
        });
      }

      const { message, sessionId, profileId } = body;

      // Validate message length
      if (message.length > 1000) {
        return reply.status(400).send({
          error: "Message must be 1000 characters or fewer",
          code: "MESSAGE_TOO_LONG",
        });
      }

      // Session management
      const redis = getRedis(app);
      const sessionOpts: ChatSessionManagerOptions = {};
      if (redis) sessionOpts.redis = redis;
      const sessionManager = getChatSessionManager(sessionOpts);

      // Optional rate limiting
      if (profileId) {
        const rateCheck = await sessionManager.checkRateLimit(profileId);
        if (!rateCheck.allowed) {
          return reply.status(429).send({
            error: "Rate limit exceeded. Please try again later.",
            code: "RATE_LIMIT_EXCEEDED",
            limit: rateCheck.limit,
            remaining: 0,
          });
        }
      }

      try {
        // Get or create session
        const session = await sessionManager.getOrCreateSession(
          sessionId,
          profileId
        );

        // Check session exhaustion
        if (sessionManager.isSessionExhausted(session)) {
          return reply.status(429).send({
            error:
              "Session has reached maximum turns. Start a new conversation.",
            code: "SESSION_EXHAUSTED",
            sessionId: session.sessionId,
          });
        }

        // Run orchestrator
        const orchestrateInput: OrchestratorInput = {
          message,
          sessionId: session.sessionId,
          context: session.context,
        };
        if (profileId) orchestrateInput.profileId = profileId;
        const result = await orchestrate(orchestrateInput, buildDeps());

        // Build response
        const response: ChatResponse = {
          sessionId: result.sessionId,
          recommendations: result.recommendations,
          reasoning: result.reasoning,
        };

        if (result.alternatives && result.alternatives.length > 0) {
          response.alternatives = result.alternatives;
        }
        if (
          result.followUpQuestions &&
          result.followUpQuestions.length > 0
        ) {
          response.followUpQuestions = result.followUpQuestions;
        }

        logger.info("Chat response sent", {
          sessionId: result.sessionId,
          recommendationCount: result.recommendations.length,
          fallbackUsed: result.fallbackUsed,
        });

        return reply.status(200).send(response);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("Chat endpoint error", { error: msg, sessionId });
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_ERROR",
        });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /v1/chat/stream — SSE streaming
  // --------------------------------------------------------------------------

  app.get(
    "/chat/stream",
    async (
      request: FastifyRequest<{
        Querystring: {
          session?: string;
          message?: string;
          profileId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      // Feature flag gate
      if (!isAIConciergeEnabled()) {
        return reply.status(503).send({
          error: "AI Concierge is currently disabled",
          code: "CONCIERGE_DISABLED",
        });
      }

      const query = request.query as Record<string, string | undefined>;
      const message = query.message;
      const sessionId = query.session;
      const profileId = query.profileId;

      if (!message) {
        return reply.status(400).send({
          error: "message query parameter is required",
          code: "INVALID_REQUEST",
        });
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: ChatStreamEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        // Send initial message event
        sendEvent({
          type: "message",
          data: { status: "processing", sessionId },
        });

        // Session management
        const sseRedis = getRedis(app);
        const sseSessionOpts: ChatSessionManagerOptions = {};
        if (sseRedis) sseSessionOpts.redis = sseRedis;
        const sessionManager = getChatSessionManager(sseSessionOpts);
        const session = await sessionManager.getOrCreateSession(
          sessionId,
          profileId
        );

        // Run orchestrator
        const sseOrchestrateInput: OrchestratorInput = {
          message,
          sessionId: session.sessionId,
          context: session.context,
        };
        if (profileId) sseOrchestrateInput.profileId = profileId;
        const result = await orchestrate(sseOrchestrateInput, buildDeps());

        // Stream recommendations one at a time
        for (const rec of result.recommendations) {
          sendEvent({
            type: "recommendation",
            data: rec,
          });
        }

        // Send done event with full response metadata
        sendEvent({
          type: "done",
          data: {
            sessionId: result.sessionId,
            reasoning: result.reasoning,
            followUpQuestions: result.followUpQuestions,
            totalRecommendations: result.recommendations.length,
            fallbackUsed: result.fallbackUsed,
          },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("Chat stream error", { error: msg, sessionId });

        sendEvent({
          type: "error",
          data: { error: "Internal server error" },
        });
      } finally {
        reply.raw.end();
      }
    }
  );

  // --------------------------------------------------------------------------
  // DELETE /v1/chat/:sessionId — End a session
  // --------------------------------------------------------------------------

  app.delete(
    "/chat/:sessionId",
    async (
      request: FastifyRequest<{ Params: { sessionId: string } }>,
      reply: FastifyReply
    ) => {
      const params = request.params as { sessionId: string };
      const { sessionId: sid } = params;

      if (!sid) {
        return reply.status(400).send({
          error: "sessionId is required",
          code: "INVALID_REQUEST",
        });
      }

      const deleteRedis = getRedis(app);
      const deleteSessionOpts: ChatSessionManagerOptions = {};
      if (deleteRedis) deleteSessionOpts.redis = deleteRedis;
      const sessionManager = getChatSessionManager(deleteSessionOpts);
      await sessionManager.endSession(sid);

      return reply.status(200).send({
        message: "Session ended",
        sessionId: sid,
      });
    }
  );

  // --------------------------------------------------------------------------
  // GET /v1/chat/health — Chat subsystem health check
  // --------------------------------------------------------------------------

  app.get("/chat/health", async (_request, reply) => {
    return reply.status(200).send({
      enabled: isAIConciergeEnabled(),
      status: isAIConciergeEnabled() ? "ready" : "disabled",
    });
  });
}
