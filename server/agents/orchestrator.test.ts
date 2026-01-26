import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyIntent,
  extractEntities,
  orchestrate,
} from "./orchestrator";
import type { OrchestratorInput } from "./types";

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
    total: { value: 2 },
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
      {
        _id: "title-2",
        _source: {
          name: "Interstellar",
          type: "movie",
          tmdbId: 157336,
          genres: ["Science Fiction", "Drama"],
          moods: [],
          voteAverage: 8.6,
          popularity: 200,
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Intent Classification Tests
// ---------------------------------------------------------------------------

describe("classifyIntent", () => {
  it("classifies availability queries", () => {
    const result = classifyIntent("Where can I watch Dune?");
    expect(result.intent).toBe("availability");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies availability with service mention", () => {
    const result = classifyIntent("Is The Bear on Netflix?");
    expect(result.intent).toBe("availability");
  });

  it("classifies recommendation queries", () => {
    const result = classifyIntent("Recommend me a good sci-fi movie");
    expect(result.intent).toBe("recommendations");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies 'what should I watch'", () => {
    const result = classifyIntent("What should I watch tonight?");
    expect(result.intent).toBe("recommendations");
  });

  it("classifies 'something similar'", () => {
    const result = classifyIntent("Show me something like Inception");
    expect(result.intent).toBe("recommendations");
  });

  it("classifies preference updates", () => {
    const result = classifyIntent("I love horror movies");
    expect(result.intent).toBe("preferences");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies social queries", () => {
    const result = classifyIntent("What are my friends watching?");
    expect(result.intent).toBe("social");
  });

  it("classifies generic text as search", () => {
    const result = classifyIntent("Dune");
    expect(result.intent).toBe("search");
  });

  it("classifies genre mentions as search", () => {
    const result = classifyIntent("action thriller");
    expect(result.intent).toBe("search");
    expect(result.entities.genres).toContain("Action");
    expect(result.entities.genres).toContain("Thriller");
  });

  it("preserves rawQuery", () => {
    const result = classifyIntent("  find me horror movies  ");
    expect(result.rawQuery).toBe("find me horror movies");
  });
});

// ---------------------------------------------------------------------------
// Entity Extraction Tests
// ---------------------------------------------------------------------------

describe("extractEntities", () => {
  it("extracts genres", () => {
    const entities = extractEntities("I want a comedy or drama");
    expect(entities.genres).toContain("Comedy");
    expect(entities.genres).toContain("Drama");
  });

  it("extracts streaming services", () => {
    const entities = extractEntities("What's on Netflix or Hulu?");
    expect(entities.services).toContain("Netflix");
    expect(entities.services).toContain("Hulu");
  });

  it("extracts Disney Plus variations", () => {
    const entities = extractEntities("on Disney+");
    expect(entities.services).toContain("Disney Plus");
  });

  it("extracts moods", () => {
    const entities = extractEntities("something funny and lighthearted");
    expect(entities.moods).toContain("comedy");
    expect(entities.moods).toContain("lighthearted");
  });

  it("extracts duration constraints (max)", () => {
    const entities = extractEntities("under 90 minutes");
    expect(entities.duration?.max).toBe(90);
  });

  it("extracts duration constraints (min)", () => {
    const entities = extractEntities("over 2 hours");
    expect(entities.duration?.min).toBe(120);
  });

  it("extracts release year (min)", () => {
    const entities = extractEntities("movies from 2020");
    expect(entities.releaseYear?.min).toBe(2020);
  });

  it("extracts release year (max)", () => {
    const entities = extractEntities("classics before 1990");
    expect(entities.releaseYear?.max).toBe(1990);
  });

  it("extracts region", () => {
    const entities = extractEntities("available in the UK");
    expect(entities.region).toBe("UK");
  });

  it("extracts quoted title names", () => {
    const entities = extractEntities('where can I watch "The Bear"?');
    expect(entities.titles).toContain("The Bear");
  });

  it("extracts multiple quoted titles", () => {
    const entities = extractEntities(
      'compare "Dune" and "Interstellar"'
    );
    expect(entities.titles).toHaveLength(2);
    expect(entities.titles).toContain("Dune");
    expect(entities.titles).toContain("Interstellar");
  });

  it("returns empty when no entities found", () => {
    const entities = extractEntities("hello");
    expect(entities.genres).toBeUndefined();
    expect(entities.services).toBeUndefined();
    expect(entities.moods).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Orchestrator Integration Tests
// ---------------------------------------------------------------------------

describe("orchestrate", () => {
  beforeEach(() => {
    // Stub fetch for OpenSearch calls
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(sampleOsResponse), { status: 200 })
      )
    );

    // Set AI_CONCIERGE_ENABLED=true for orchestrator to proceed
    vi.stubEnv("AI_CONCIERGE_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a valid output for a search query", async () => {
    const prisma = makePrisma();
    const input: OrchestratorInput = {
      message: "sci-fi movies on Netflix",
    };

    const result = await orchestrate(input, { prisma });

    expect(result.sessionId).toBeDefined();
    expect(result.reasoning).toBeDefined();
    expect(result.fallbackUsed).toBe(true);
    expect(result.workerResults.length).toBeGreaterThan(0);
  });

  it("classifies and routes availability queries", async () => {
    const prisma = makePrisma();
    const input: OrchestratorInput = {
      message: 'Where can I watch "Dune"?',
    };

    const result = await orchestrate(input, { prisma });

    expect(result.sessionId).toBeDefined();
    // Availability intent should route to availability worker
    const availResult = result.workerResults.find(
      (r) => r.worker === "availability"
    );
    expect(availResult).toBeDefined();
  });

  it("classifies and routes recommendation queries", async () => {
    const prisma = makePrisma();
    const input: OrchestratorInput = {
      message: "What should I watch tonight?",
    };

    const result = await orchestrate(input, { prisma });

    expect(result.sessionId).toBeDefined();
    const recsResult = result.workerResults.find(
      (r) => r.worker === "recommendations"
    );
    expect(recsResult).toBeDefined();
  });

  it("generates follow-up questions", async () => {
    const prisma = makePrisma();
    const input: OrchestratorInput = {
      message: "Recommend a movie",
    };

    const result = await orchestrate(input, { prisma });

    expect(result.followUpQuestions).toBeDefined();
    expect(result.followUpQuestions!.length).toBeGreaterThan(0);
  });

  it("persists session across calls", async () => {
    const prisma = makePrisma();
    const first = await orchestrate(
      { message: "sci-fi movies" },
      { prisma }
    );

    const second = await orchestrate(
      { message: "something similar", sessionId: first.sessionId },
      { prisma }
    );

    expect(second.sessionId).toBe(first.sessionId);
  });

  it("uses NLU fallback when AI_CONCIERGE is disabled", async () => {
    vi.stubEnv("AI_CONCIERGE_ENABLED", "false");

    const prisma = makePrisma();
    const result = await orchestrate(
      { message: "recommend a comedy" },
      { prisma }
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.sessionId).toBeDefined();
  });

  it("handles worker failures gracefully", async () => {
    // Stub fetch to fail
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network error");
      })
    );

    const prisma = makePrisma();
    prisma.title.findMany = vi.fn(async () => []);

    const result = await orchestrate(
      { message: "search for something" },
      { prisma }
    );

    // Should still return a valid output even if workers fail
    expect(result.sessionId).toBeDefined();
    expect(result.reasoning).toBeDefined();
  });
});
