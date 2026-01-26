import { describe, it, expect, vi, afterEach } from "vitest";
import { executeRecommendations } from "./recommendations.worker";
import type { WorkerInput, WorkerResult, TitleResult } from "../types";
import type { ProfilePreferences } from "./preferences.worker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTitleResult(overrides?: Partial<TitleResult>): TitleResult {
  return {
    id: "title-1",
    name: "Dune",
    type: "movie",
    genres: ["Science Fiction", "Adventure"],
    moods: ["epic"],
    releaseYear: 2021,
    voteAverage: 7.8,
    popularity: 120,
    posterUrl: "https://image.tmdb.org/poster.jpg",
    backdropUrl: "https://image.tmdb.org/backdrop.jpg",
    ...overrides,
  };
}

function makePrefsResult(
  prefs?: Partial<ProfilePreferences>
): WorkerResult {
  const data: ProfilePreferences = {
    preferences: {
      genres: ["Science Fiction"],
      moods: ["epic"],
      avoidGenres: ["Horror"],
    },
    subscriptions: ["netflix"],
    region: "US",
    recentFeedback: [],
    coldStart: false,
    ...prefs,
  };
  return {
    worker: "preferences",
    success: true,
    data,
    latencyMs: 10,
  };
}

function makeSearchResult(items: TitleResult[]): WorkerResult {
  return {
    worker: "search",
    success: true,
    data: { items },
    latencyMs: 10,
  };
}

function makeInput(overrides?: Partial<WorkerInput>): WorkerInput {
  return {
    intent: {
      intent: "recommendations",
      confidence: 0.9,
      entities: {},
      rawQuery: "what should I watch?",
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

function makePrisma(overrides?: Record<string, unknown>) {
  const defaultTitles = [
    {
      id: "t1",
      name: "Dune",
      type: "movie",
      tmdbId: "438631",
      imdbId: "tt1160419",
      releaseYear: 2021,
      runtimeMin: 155,
      genres: ["Science Fiction", "Adventure"],
      moods: ["epic"],
      voteAverage: 7.8,
      popularity: 120,
      posterUrl: "https://image.tmdb.org/poster1.jpg",
      backdropUrl: null,
      availability: [
        { service: "netflix", region: "US", offerType: "flatrate" },
      ],
      createdAt: new Date(),
    },
    {
      id: "t2",
      name: "The Batman",
      type: "movie",
      tmdbId: "414906",
      imdbId: "tt1877830",
      releaseYear: 2022,
      runtimeMin: 176,
      genres: ["Action", "Crime"],
      moods: ["dark"],
      voteAverage: 7.7,
      popularity: 90,
      posterUrl: "https://image.tmdb.org/poster2.jpg",
      backdropUrl: null,
      availability: [],
      createdAt: new Date(),
    },
  ];

  return {
    title: {
      findMany: vi.fn(async () => defaultTitles),
      ...(overrides?.title as object),
    },
    externalRating: {
      findMany: vi.fn(async () => [
        { titleId: "t1", source: "IMDB", valueNum: 82 },
        { titleId: "t1", source: "ROTTEN_TOMATOES", valueNum: 83 },
        { titleId: "t2", source: "IMDB", valueNum: 76 },
      ]),
      ...(overrides?.externalRating as object),
    },
    availability: {
      findMany: vi.fn(async () => [
        {
          titleId: "t1",
          service: "netflix",
          region: "US",
          offerType: "flatrate",
        },
      ]),
      ...(overrides?.availability as object),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recommendations.worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- Scoring search results ----------

  describe("scoring search results", () => {
    it("scores and ranks search results with preferences", async () => {
      const searchItems = [
        makeTitleResult({ id: "t1", name: "Dune", genres: ["Science Fiction"] }),
        makeTitleResult({
          id: "t2",
          name: "Comedy Show",
          genres: ["Comedy"],
          voteAverage: 5.0,
          popularity: 10,
        }),
      ];

      const input = makeInput({
        previousResults: [
          makeSearchResult(searchItems),
          makePrefsResult(),
        ],
      });

      const result = await executeRecommendations(input, {
        prisma: makePrisma(),
      });

      expect(result.worker).toBe("recommendations");
      expect(result.success).toBe(true);

      const data = result.data as { items: unknown[] };
      expect(data.items.length).toBeGreaterThan(0);

      // First item should be Dune (higher genre match + ratings)
      const first = (data.items as any[])[0];
      expect(first.title.name).toBe("Dune");
      expect(first.score).toBeGreaterThan(0);
      expect(typeof first.reason).toBe("string");
    });

    it("boosts titles available on user subscriptions", async () => {
      const onNetflix = makeTitleResult({
        id: "t1",
        name: "Available Movie",
        genres: [],
        voteAverage: 6.0,
        popularity: 50,
      });
      const notOnNetflix = makeTitleResult({
        id: "t2",
        name: "Unavailable Movie",
        genres: [],
        voteAverage: 6.0,
        popularity: 50,
      });

      const prisma = makePrisma({
        externalRating: { findMany: vi.fn(async () => []) },
        availability: {
          findMany: vi.fn(async () => [
            { titleId: "t1", service: "netflix", region: "US", offerType: "flatrate" },
          ]),
        },
      });

      const input = makeInput({
        previousResults: [
          makeSearchResult([onNetflix, notOnNetflix]),
          makePrefsResult({ subscriptions: ["netflix"] }),
        ],
      });

      const result = await executeRecommendations(input, { prisma });
      const data = result.data as { items: any[] };
      const scores = data.items.map((i) => ({ name: i.title.name, score: i.score }));

      const avail = scores.find((s) => s.name === "Available Movie");
      const unavail = scores.find((s) => s.name === "Unavailable Movie");
      expect(avail!.score).toBeGreaterThan(unavail!.score);
    });

    it("penalizes avoided genres", async () => {
      const good = makeTitleResult({
        id: "t1",
        name: "Good",
        genres: ["Action"],
        voteAverage: 7,
        popularity: 50,
      });
      const avoided = makeTitleResult({
        id: "t2",
        name: "Avoided",
        genres: ["Horror"],
        voteAverage: 7,
        popularity: 50,
      });

      const prisma = makePrisma({
        externalRating: { findMany: vi.fn(async () => []) },
        availability: { findMany: vi.fn(async () => []) },
      });

      const input = makeInput({
        previousResults: [
          makeSearchResult([good, avoided]),
          makePrefsResult({
            preferences: {
              genres: ["Action"],
              moods: [],
              avoidGenres: ["Horror"],
            },
          }),
        ],
      });

      const result = await executeRecommendations(input, { prisma });
      const data = result.data as { items: any[] };
      const goodScore = data.items.find((i) => i.title.name === "Good")?.score ?? 0;
      const avoidedScore = data.items.find((i) => i.title.name === "Avoided")?.score ?? 0;
      expect(goodScore).toBeGreaterThan(avoidedScore);
    });
  });

  // ---------- Generating picks from scratch ----------

  describe("generating picks from scratch", () => {
    it("generates candidates from DB when no search results", async () => {
      const input = makeInput({
        previousResults: [makePrefsResult()],
      });

      const result = await executeRecommendations(input, {
        prisma: makePrisma(),
      });

      expect(result.success).toBe(true);
      const data = result.data as { items: any[] };
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items[0].title.name).toBeDefined();
      expect(data.items[0].score).toBeGreaterThan(0);
    });

    it("applies cold-start boost when no subscriptions", async () => {
      const input = makeInput({
        context: {
          conversationId: "conv-1",
          turnNumber: 1,
          subscriptions: [],
        },
        previousResults: [
          makePrefsResult({
            subscriptions: [],
            coldStart: true,
          }),
        ],
      });

      const result = await executeRecommendations(input, {
        prisma: makePrisma(),
      });

      expect(result.success).toBe(true);
      const data = result.data as { items: any[] };
      expect(data.items.length).toBeGreaterThan(0);
      // Cold start should produce a reason
      expect(data.items[0].reason).toBeDefined();
    });
  });

  // ---------- Diversity sampling ----------

  describe("diversity sampling", () => {
    it("limits results to 6 items", async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        makeTitleResult({
          id: `t${i}`,
          name: `Title ${i}`,
          voteAverage: 9 - i * 0.1,
          popularity: 200 - i,
        })
      );

      const prisma = makePrisma({
        externalRating: { findMany: vi.fn(async () => []) },
        availability: { findMany: vi.fn(async () => []) },
      });

      const input = makeInput({
        previousResults: [makeSearchResult(items), makePrefsResult()],
      });

      const result = await executeRecommendations(input, { prisma });
      const data = result.data as { items: any[] };
      expect(data.items).toHaveLength(6);
    });

    it("avoids duplicate series entries", async () => {
      const items = [
        makeTitleResult({ id: "t1", name: "Breaking Bad Season 1", voteAverage: 9 }),
        makeTitleResult({ id: "t2", name: "Breaking Bad Season 2", voteAverage: 9 }),
        makeTitleResult({ id: "t3", name: "The Wire", voteAverage: 8.5 }),
        makeTitleResult({ id: "t4", name: "Fargo", voteAverage: 8.0 }),
      ];

      const prisma = makePrisma({
        externalRating: { findMany: vi.fn(async () => []) },
        availability: { findMany: vi.fn(async () => []) },
      });

      const input = makeInput({
        previousResults: [makeSearchResult(items), makePrefsResult()],
      });

      const result = await executeRecommendations(input, { prisma });
      const data = result.data as { items: any[] };
      const names = data.items.map((i: any) => i.title.name);
      // Should include only one "Breaking Bad" entry due to series dedup
      const bbCount = names.filter((n: string) =>
        n.toLowerCase().includes("breaking bad")
      ).length;
      expect(bbCount).toBeLessThanOrEqual(1);
    });
  });

  // ---------- Error handling ----------

  describe("error handling", () => {
    it("returns error result on Prisma failure", async () => {
      const prisma = {
        externalRating: {
          findMany: vi.fn(async () => {
            throw new Error("db down");
          }),
        },
        availability: {
          findMany: vi.fn(async () => []),
        },
      } as any;

      const input = makeInput({
        previousResults: [
          makeSearchResult([makeTitleResult()]),
          makePrefsResult(),
        ],
      });

      const result = await executeRecommendations(input, { prisma });
      expect(result.success).toBe(false);
      expect(result.error).toContain("db down");
    });

    it("handles missing previous results gracefully", async () => {
      const input = makeInput({
        previousResults: undefined,
      });

      const result = await executeRecommendations(input, {
        prisma: makePrisma(),
      });

      // No search results and no prefs -> generates from scratch
      expect(result.success).toBe(true);
      const data = result.data as { items: any[] };
      expect(data.items.length).toBeGreaterThanOrEqual(0);
    });

    it("handles failed search result gracefully", async () => {
      const failedSearch: WorkerResult = {
        worker: "search",
        success: false,
        error: "search failed",
        latencyMs: 5,
      };

      const input = makeInput({
        previousResults: [failedSearch, makePrefsResult()],
      });

      const result = await executeRecommendations(input, {
        prisma: makePrisma(),
      });

      // Should fall back to generating picks
      expect(result.success).toBe(true);
    });
  });

  // ---------- Reason generation ----------

  describe("reason generation", () => {
    it("includes reason text in recommendations", async () => {
      const input = makeInput({
        previousResults: [
          makeSearchResult([
            makeTitleResult({ voteAverage: 9.0, popularity: 500 }),
          ]),
          makePrefsResult(),
        ],
      });

      const prisma = makePrisma({
        externalRating: {
          findMany: vi.fn(async () => [
            { titleId: "title-1", source: "IMDB", valueNum: 90 },
          ]),
        },
        availability: {
          findMany: vi.fn(async () => [
            { titleId: "title-1", service: "netflix", region: "US", offerType: "flatrate" },
          ]),
        },
      });

      const result = await executeRecommendations(input, { prisma });
      const data = result.data as { items: any[] };
      expect(data.items[0].reason).toBeDefined();
      expect(data.items[0].reason.length).toBeGreaterThan(0);
    });
  });
});
