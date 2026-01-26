import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import chatRouter from "./router";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    profile: {
      findUnique: vi.fn(async () => null),
    },
    subscription: {
      findMany: vi.fn(async () => []),
    },
    feedback: {
      findMany: vi.fn(async () => []),
    },
    title: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    externalRating: {
      findMany: vi.fn(async () => []),
    },
    availability: {
      findMany: vi.fn(async () => []),
    },
  } as any;
}

const sampleOsResponse = {
  hits: {
    total: { value: 1 },
    hits: [
      {
        _id: "title-1",
        _source: {
          name: "Dune",
          type: "movie",
          tmdbId: 438631,
          genres: ["Science Fiction"],
          moods: [],
          voteAverage: 7.8,
          popularity: 120,
        },
      },
    ],
  },
};

async function buildApp(envOverrides?: Record<string, string>) {
  // Apply env overrides
  for (const [key, value] of Object.entries(envOverrides || {})) {
    process.env[key] = value;
  }

  const app = Fastify({ logger: false });
  await app.register(chatRouter, { prisma: makePrisma() });
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("chat router", () => {
  beforeEach(() => {
    // Stub fetch for OpenSearch
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(sampleOsResponse), { status: 200 })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Clean up env vars
    delete process.env.AI_CONCIERGE_ENABLED;
  });

  // ---------- Health endpoint ----------

  describe("GET /chat/health", () => {
    it("returns disabled status when feature flag is off", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "false" });
      const res = await app.inject({
        method: "GET",
        url: "/chat/health",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.enabled).toBe(false);
      expect(body.status).toBe("disabled");
      await app.close();
    });

    it("returns ready status when feature flag is on", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "GET",
        url: "/chat/health",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.enabled).toBe(true);
      expect(body.status).toBe("ready");
      await app.close();
    });
  });

  // ---------- POST /chat ----------

  describe("POST /chat", () => {
    it("returns 503 when AI_CONCIERGE_ENABLED=false", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "false" });
      const res = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "hello" },
      });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.code).toBe("CONCIERGE_DISABLED");
      await app.close();
    });

    it("returns 400 when message is missing", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "POST",
        url: "/chat",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe("INVALID_REQUEST");
      await app.close();
    });

    it("returns 400 when message exceeds 1000 chars", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "a".repeat(1001) },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe("MESSAGE_TOO_LONG");
      await app.close();
    });

    it("returns 200 with recommendations for valid request", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "recommend a sci-fi movie" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.sessionId).toBeDefined();
      expect(body.reasoning).toBeDefined();
      expect(body.recommendations).toBeDefined();
      expect(Array.isArray(body.recommendations)).toBe(true);
      await app.close();
    });

    it("returns sessionId for session continuity", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res1 = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "sci-fi movies" },
      });
      const body1 = res1.json();
      expect(body1.sessionId).toBeDefined();

      // Use session ID from first call
      const res2 = await app.inject({
        method: "POST",
        url: "/chat",
        payload: {
          message: "something similar",
          sessionId: body1.sessionId,
        },
      });
      const body2 = res2.json();
      expect(body2.sessionId).toBe(body1.sessionId);
      await app.close();
    });

    it("includes follow-up questions", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "what should I watch?" },
      });
      const body = res.json();
      expect(body.followUpQuestions).toBeDefined();
      expect(body.followUpQuestions.length).toBeGreaterThan(0);
      await app.close();
    });
  });

  // ---------- GET /chat/stream ----------

  describe("GET /chat/stream", () => {
    it("returns 503 when feature flag is off", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "false" });
      const res = await app.inject({
        method: "GET",
        url: "/chat/stream?message=hello",
      });
      expect(res.statusCode).toBe(503);
      await app.close();
    });

    it("returns 400 when message is missing", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "GET",
        url: "/chat/stream",
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    });

    it("returns SSE events for valid request", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });
      const res = await app.inject({
        method: "GET",
        url: "/chat/stream?message=recommend+a+movie",
      });
      // SSE response uses raw headers, inject captures the body
      expect(res.statusCode).toBe(200);
      const body = res.body;
      // Should contain SSE data events
      expect(body).toContain("data:");
      // Should have a "done" event
      expect(body).toContain('"type":"done"');
      await app.close();
    });
  });

  // ---------- DELETE /chat/:sessionId ----------

  describe("DELETE /chat/:sessionId", () => {
    it("ends a session", async () => {
      const app = await buildApp({ AI_CONCIERGE_ENABLED: "true" });

      // First create a session
      const createRes = await app.inject({
        method: "POST",
        url: "/chat",
        payload: { message: "hello" },
      });
      const { sessionId } = createRes.json();

      // Then delete it
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/chat/${sessionId}`,
      });
      expect(deleteRes.statusCode).toBe(200);
      const body = deleteRes.json();
      expect(body.sessionId).toBe(sessionId);
      expect(body.message).toBe("Session ended");
      await app.close();
    });
  });
});
