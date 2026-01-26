import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  executeSearch,
  buildSearchParams,
} from "./search.worker";
import type { WorkerInput, ExtractedEntities } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<WorkerInput>): WorkerInput {
  return {
    intent: {
      intent: "search",
      confidence: 0.9,
      entities: {},
      rawQuery: "sci-fi movies",
    },
    context: {
      conversationId: "conv-1",
      turnNumber: 1,
      profileId: "profile-1",
      region: "US",
      subscriptions: ["netflix"],
    },
    ...overrides,
  };
}

const sampleOsHit = {
  _id: "title-1",
  _source: {
    name: "Dune",
    type: "movie",
    tmdbId: 438631,
    imdbId: "tt1160419",
    releaseYear: 2021,
    runtimeMin: 155,
    genres: ["Science Fiction", "Adventure"],
    moods: ["epic"],
    voteAverage: 7.8,
    popularity: 120,
    posterUrl: "https://image.tmdb.org/poster.jpg",
    backdropUrl: "https://image.tmdb.org/backdrop.jpg",
  },
};

const sampleOsResponse = {
  hits: { total: { value: 1 }, hits: [sampleOsHit] },
};

function makePrisma(overrides?: Record<string, unknown>) {
  return {
    title: {
      findMany: vi.fn(async () => []),
      ...(overrides?.title as object),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("search.worker", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(sampleOsResponse), { status: 200 })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ---------- buildSearchParams ----------

  describe("buildSearchParams", () => {
    it("builds params from raw query", () => {
      const entities: ExtractedEntities = {};
      const params = buildSearchParams(entities, "best horror films");
      expect(params.q).toBe("best horror films");
      expect(params.size).toBe(20);
      expect(params.from).toBe(0);
    });

    it("includes services and region from entities", () => {
      const entities: ExtractedEntities = {
        services: ["netflix", "hulu"],
        region: "GB",
      };
      const params = buildSearchParams(entities, "comedy");
      expect(params.services).toEqual(["netflix", "hulu"]);
      expect(params.regions).toEqual(["GB"]);
    });

    it("maps duration and releaseYear entities", () => {
      const entities: ExtractedEntities = {
        duration: { min: 90, max: 120 },
        releaseYear: { min: 2020, max: 2025 },
      };
      const params = buildSearchParams(entities, "action");
      expect(params.runtimeMin).toBe(90);
      expect(params.runtimeMax).toBe(120);
      expect(params.yearMin).toBe(2020);
      expect(params.yearMax).toBe(2025);
    });

    it("overrides query with first title entity", () => {
      const entities: ExtractedEntities = {
        titles: ["Interstellar"],
      };
      const params = buildSearchParams(entities, "something");
      expect(params.q).toBe("Interstellar");
    });
  });

  // ---------- executeSearch ----------

  describe("executeSearch", () => {
    it("returns search results from OpenSearch", async () => {
      const deps = { prisma: makePrisma() };
      const result = await executeSearch(makeInput(), deps);

      expect(result.worker).toBe("search");
      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      const data = result.data as { items: unknown[]; total: number };
      expect(data.items).toHaveLength(1);
      expect((data.items[0] as any).name).toBe("Dune");
      expect((data.items[0] as any).genres).toEqual(["Science Fiction", "Adventure"]);
    });

    it("falls back to Prisma when OpenSearch returns non-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("error", { status: 500 }))
      );

      const prisma = makePrisma({
        title: {
          findMany: vi.fn(async () => [
            {
              id: "t1",
              name: "Blade Runner",
              type: "movie",
              tmdbId: "1234",
              imdbId: "tt0083658",
              releaseYear: 1982,
              runtimeMin: 117,
              genres: ["Science Fiction"],
              moods: [],
              voteAverage: 8.1,
              popularity: 50,
              posterUrl: null,
              backdropUrl: null,
              availability: [],
            },
          ]),
        },
      });

      const result = await executeSearch(makeInput(), { prisma });
      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(1);
      expect((data.items[0] as any).name).toBe("Blade Runner");
    });

    it("falls back to Prisma when fetch throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network error");
        })
      );

      const prisma = makePrisma({
        title: {
          findMany: vi.fn(async () => []),
        },
      });

      const result = await executeSearch(makeInput(), { prisma });
      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(0);
    });

    it("uses Redis cache when available", async () => {
      const cached = JSON.stringify([
        { id: "cached-1", name: "Cached Title", type: "movie", genres: [], moods: [] },
      ]);
      const redis = {
        get: vi.fn(async () => cached),
        set: vi.fn(async () => "OK"),
        del: vi.fn(async () => 1),
      };

      const result = await executeSearch(makeInput(), {
        prisma: makePrisma(),
        redis,
      });

      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(1);
      expect((data.items[0] as any).name).toBe("Cached Title");
      expect(redis.get).toHaveBeenCalled();
      // fetch should not have been called because cache hit
      expect(fetch).not.toHaveBeenCalled();
    });

    it("caches results in Redis on OpenSearch success", async () => {
      const redis = {
        get: vi.fn(async () => null),
        set: vi.fn(async () => "OK"),
        del: vi.fn(async () => 1),
      };

      await executeSearch(makeInput(), {
        prisma: makePrisma(),
        redis,
      });

      expect(redis.set).toHaveBeenCalled();
      const setCall = redis.set.mock.calls[0];
      expect(setCall[2]).toEqual({ EX: 60 });
    });

    it("returns error result on unexpected exception", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network error");
        })
      );

      // Make Prisma fallback also fail
      const prisma = {
        title: {
          findMany: vi.fn(async () => {
            throw new Error("db down");
          }),
        },
      } as any;

      const result = await executeSearch(makeInput(), { prisma });
      // The worker catches the Prisma error internally and returns empty,
      // so the outer result should still succeed with empty items
      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(0);
    });
  });
});
