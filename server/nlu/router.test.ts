import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import nluRouter from "./router";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(nluRouter);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NLU Router", () => {
  let origNluEnabled: string | undefined;

  beforeEach(() => {
    origNluEnabled = process.env.NLU_ENABLED;
  });

  afterEach(() => {
    if (origNluEnabled === undefined) {
      delete process.env.NLU_ENABLED;
    } else {
      process.env.NLU_ENABLED = origNluEnabled;
    }
  });

  it("returns 200 with parsed entities for valid query", async () => {
    process.env.NLU_ENABLED = "true";
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/nlu/parse?q=funny+movies+on+Netflix+under+2+hours",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.originalQuery).toBe("funny movies on Netflix under 2 hours");
    expect(body.cleanQuery).toBeDefined();
    expect(body.entities).toBeDefined();
    expect(body.entities.services).toContain("Netflix");
    expect(body.entities.moods).toContain("comedy");
    expect(body.entities.duration).toEqual({ max: 120 });

    await app.close();
  });

  it("returns cleaned query with entities stripped", async () => {
    process.env.NLU_ENABLED = "true";
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/nlu/parse?q=sci-fi+from+2020",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.entities.genres).toContain("Science Fiction");
    expect(body.entities.releaseYear).toEqual({ min: 2020 });
    // Clean query should not contain "from 2020"
    expect(body.cleanQuery).not.toContain("from 2020");

    await app.close();
  });

  it("returns 400 when q parameter is missing", async () => {
    process.env.NLU_ENABLED = "true";
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/nlu/parse",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("INVALID_REQUEST");

    await app.close();
  });

  it("returns 400 when q is empty", async () => {
    process.env.NLU_ENABLED = "true";
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/nlu/parse?q=",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("INVALID_REQUEST");

    await app.close();
  });

  it("returns 503 when NLU is disabled", async () => {
    process.env.NLU_ENABLED = "false";
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/nlu/parse?q=funny+movies",
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.code).toBe("NLU_DISABLED");

    await app.close();
  });

  it("returns empty entities for query with no recognized patterns", async () => {
    process.env.NLU_ENABLED = "true";
    const app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/nlu/parse?q=hello+world",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.originalQuery).toBe("hello world");
    expect(body.cleanQuery).toBeDefined();

    await app.close();
  });
});
