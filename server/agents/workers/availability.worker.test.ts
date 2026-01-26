import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  executeAvailability,
  formatAvailabilityResponse,
} from "./availability.worker";
import type { WorkerInput, AvailabilityResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<WorkerInput>): WorkerInput {
  return {
    intent: {
      intent: "availability",
      confidence: 0.95,
      entities: {
        titles: ["Dune"],
        region: "US",
        services: ["netflix"],
      },
      rawQuery: "Where can I watch Dune?",
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

const sampleAvailabilityRow = {
  id: "avail-1",
  titleId: "title-1",
  service: "netflix",
  region: "US",
  offerType: "flatrate",
  deepLink: "https://netflix.com/watch/123",
};

function makePrisma(titleResult?: unknown) {
  return {
    title: {
      findFirst: vi.fn(async () =>
        titleResult !== undefined
          ? titleResult
          : {
              id: "title-1",
              name: "Dune",
              availability: [sampleAvailabilityRow],
            }
      ),
    },
  } as any;
}

function makeMCPClient(overrides?: { callTool?: unknown }) {
  return {
    callTool: vi.fn(async () => ({
      success: true,
      data: [
        {
          titleId: "title-1",
          service: "hbomax",
          region: "US",
          offerType: "flatrate" as const,
        },
      ],
    })),
    ...(overrides || {}),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("availability.worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- executeAvailability ----------

  describe("executeAvailability", () => {
    it("returns availability from local Prisma DB", async () => {
      const prisma = makePrisma();
      const result = await executeAvailability(makeInput(), { prisma });

      expect(result.worker).toBe("availability");
      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      const data = result.data as { items: AvailabilityResult[] };
      expect(data.items).toHaveLength(1);
      const first = data.items[0];
      expect(first).toBeDefined();
      expect(first?.service).toBe("netflix");
      expect(first?.region).toBe("US");
      expect(first?.offerType).toBe("flatrate");
    });

    it("returns empty items when no titles specified", async () => {
      const input = makeInput({
        intent: {
          intent: "availability",
          confidence: 0.5,
          entities: { titles: [] },
          rawQuery: "what can I watch?",
        },
      });
      const result = await executeAvailability(input, { prisma: makePrisma() });

      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[]; message: string };
      expect(data.items).toHaveLength(0);
      expect(data.message).toContain("No titles specified");
    });

    it("returns empty items when entities.titles is undefined", async () => {
      const input = makeInput({
        intent: {
          intent: "availability",
          confidence: 0.5,
          entities: {},
          rawQuery: "what can I watch?",
        },
      });
      const result = await executeAvailability(input, { prisma: makePrisma() });

      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(0);
    });

    it("returns empty when title not found in DB", async () => {
      const prisma = makePrisma(null);
      const result = await executeAvailability(makeInput(), { prisma });

      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(0);
    });

    it("uses context region when entities.region is missing", async () => {
      const input = makeInput({
        intent: {
          intent: "availability",
          confidence: 0.9,
          entities: { titles: ["Dune"] },
          rawQuery: "Where can I watch Dune?",
        },
        context: {
          conversationId: "conv-1",
          turnNumber: 1,
          region: "GB",
          subscriptions: [],
        },
      });
      const prisma = makePrisma();
      await executeAvailability(input, { prisma });

      // Verify the findFirst was called with region "GB"
      const call = prisma.title.findFirst.mock.calls[0][0];
      expect(call.include.availability.where.region).toBe("GB");
    });

    it("handles Prisma errors gracefully", async () => {
      const prisma = {
        title: {
          findFirst: vi.fn(async () => {
            throw new Error("db error");
          }),
        },
      } as any;

      const result = await executeAvailability(makeInput(), { prisma });
      // The worker catches per-title errors internally, so the overall result still succeeds
      expect(result.success).toBe(true);
      const data = result.data as { items: unknown[] };
      expect(data.items).toHaveLength(0);
    });

    it("returns error result on unexpected exception", async () => {
      // Simulate a top-level error by passing an input that causes a throw
      const result = await executeAvailability(
        null as any, // This will cause a property access error
        { prisma: makePrisma() }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ---------- formatAvailabilityResponse ----------

  describe("formatAvailabilityResponse", () => {
    it("formats streaming results", () => {
      const results: AvailabilityResult[] = [
        {
          titleId: "t1",
          service: "Netflix",
          region: "US",
          offerType: "flatrate",
        },
      ];
      const msg = formatAvailabilityResponse(results, "Dune");
      expect(msg).toContain("Dune");
      expect(msg).toContain("streaming on Netflix");
    });

    it("formats rent and buy results", () => {
      const results: AvailabilityResult[] = [
        { titleId: "t1", service: "Apple TV", region: "US", offerType: "rent" },
        {
          titleId: "t1",
          service: "Google Play",
          region: "US",
          offerType: "buy",
        },
      ];
      const msg = formatAvailabilityResponse(results, "Inception");
      expect(msg).toContain("available to rent on Apple TV");
      expect(msg).toContain("available to buy on Google Play");
    });

    it("formats free/ads results", () => {
      const results: AvailabilityResult[] = [
        { titleId: "t1", service: "Tubi", region: "US", offerType: "free" },
      ];
      const msg = formatAvailabilityResponse(results, "Old Movie");
      expect(msg).toContain("free with ads on Tubi");
    });

    it("returns not-found message for empty results", () => {
      const msg = formatAvailabilityResponse([], "Unknown Title");
      expect(msg).toContain("couldn't find");
      expect(msg).toContain("Unknown Title");
    });

    it("deduplicates services within the same offer type", () => {
      const results: AvailabilityResult[] = [
        {
          titleId: "t1",
          service: "Netflix",
          region: "US",
          offerType: "flatrate",
        },
        {
          titleId: "t1",
          service: "Netflix",
          region: "US",
          offerType: "flatrate",
        },
      ];
      const msg = formatAvailabilityResponse(results, "Movie");
      // Should not say "Netflix, Netflix"
      const streaming = msg.match(/streaming on (.+)/);
      expect(streaming?.[1]).toBe("Netflix.");
    });
  });
});
