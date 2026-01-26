import { describe, it, expect, vi, afterEach } from "vitest";
import {
  executePreferences,
  buildPreferencesPromptContext,
} from "./preferences.worker";
import type { WorkerInput } from "../types";
import type { ProfilePreferences } from "./preferences.worker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides?: Partial<WorkerInput>): WorkerInput {
  return {
    intent: {
      intent: "preferences",
      confidence: 0.9,
      entities: {},
      rawQuery: "what are my preferences?",
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

function makePrisma(overrides?: {
  profile?: unknown;
  subscriptions?: unknown[];
  feedback?: unknown[];
}) {
  return {
    profile: {
      findUnique: vi.fn(async () =>
        overrides?.profile !== undefined
          ? overrides.profile
          : {
              preferences: {
                genres: ["Science Fiction", "Action"],
                moods: ["epic"],
                avoidGenres: ["Horror"],
                minRating: 7,
              },
              locale: "en-US",
              user: { region: "US" },
            }
      ),
    },
    subscription: {
      findMany: vi.fn(async () =>
        overrides?.subscriptions !== undefined
          ? overrides.subscriptions
          : [
              { service: "netflix", region: "US" },
              { service: "hulu", region: "US" },
            ]
      ),
    },
    feedback: {
      findMany: vi.fn(async () =>
        overrides?.feedback !== undefined
          ? overrides.feedback
          : [
              {
                titleId: "t1",
                action: "LIKE",
                title: { name: "Dune", genres: ["Science Fiction"] },
              },
              {
                titleId: "t2",
                action: "DISLIKE",
                title: { name: "Saw", genres: ["Horror"] },
              },
            ]
      ),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("preferences.worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- executePreferences ----------

  describe("executePreferences", () => {
    it("returns cold-start defaults when no profileId", async () => {
      const input = makeInput({
        context: {
          conversationId: "conv-1",
          turnNumber: 1,
          subscriptions: [],
        },
      });
      const result = await executePreferences(input, {
        prisma: makePrisma(),
      });

      expect(result.worker).toBe("preferences");
      expect(result.success).toBe(true);

      const data = result.data as ProfilePreferences;
      expect(data.coldStart).toBe(true);
      expect(data.subscriptions).toHaveLength(0);
      expect(data.preferences.genres).toHaveLength(0);
      expect(data.region).toBe("US");
    });

    it("loads profile preferences from DB", async () => {
      const prisma = makePrisma();
      const result = await executePreferences(makeInput(), { prisma });

      expect(result.success).toBe(true);
      const data = result.data as ProfilePreferences;
      expect(data.preferences.genres).toContain("Science Fiction");
      expect(data.preferences.genres).toContain("Action");
      expect(data.preferences.avoidGenres).toContain("Horror");
      expect(data.subscriptions).toEqual(["netflix", "hulu"]);
      expect(data.region).toBe("US");
      expect(data.coldStart).toBe(false);
    });

    it("reports cold start when no subscriptions", async () => {
      const prisma = makePrisma({ subscriptions: [] });
      const result = await executePreferences(makeInput(), { prisma });

      expect(result.success).toBe(true);
      const data = result.data as ProfilePreferences;
      expect(data.coldStart).toBe(true);
    });

    it("infers genres from feedback when explicit genres are empty", async () => {
      const prisma = makePrisma({
        profile: {
          preferences: { genres: [], moods: [], avoidGenres: [] },
          locale: "en-US",
          user: { region: "US" },
        },
        subscriptions: [{ service: "netflix", region: "US" }],
        feedback: [
          {
            titleId: "t1",
            action: "LIKE",
            title: { name: "Dune", genres: ["Sci-Fi", "Adventure"] },
          },
          {
            titleId: "t2",
            action: "LIKE",
            title: { name: "Interstellar", genres: ["Sci-Fi", "Drama"] },
          },
          {
            titleId: "t3",
            action: "DISLIKE",
            title: { name: "Comedy Show", genres: ["Comedy"] },
          },
        ],
      });

      const result = await executePreferences(makeInput(), { prisma });
      expect(result.success).toBe(true);

      const data = result.data as ProfilePreferences;
      // Sci-Fi has 2 likes, should be top; Comedy has -1, should not appear
      expect(data.preferences.genres[0]).toBe("Sci-Fi");
      expect(data.preferences.genres).not.toContain("Comedy");
    });

    it("derives region from user profile", async () => {
      const prisma = makePrisma({
        profile: {
          preferences: {},
          locale: null,
          user: { region: "GB" },
        },
      });
      const result = await executePreferences(makeInput(), { prisma });
      const data = result.data as ProfilePreferences;
      expect(data.region).toBe("GB");
    });

    it("derives region from locale when user region is null", async () => {
      const prisma = makePrisma({
        profile: {
          preferences: {},
          locale: "fr-FR",
          user: { region: null },
        },
      });
      const result = await executePreferences(makeInput(), { prisma });
      const data = result.data as ProfilePreferences;
      expect(data.region).toBe("FR");
    });

    it("defaults region to US when no locale or user region", async () => {
      const prisma = makePrisma({
        profile: {
          preferences: {},
          locale: null,
          user: { region: null },
        },
      });
      const result = await executePreferences(makeInput(), { prisma });
      const data = result.data as ProfilePreferences;
      expect(data.region).toBe("US");
    });

    it("includes feedback summary in result", async () => {
      const result = await executePreferences(makeInput(), {
        prisma: makePrisma(),
      });
      const data = result.data as ProfilePreferences;
      expect(data.recentFeedback).toHaveLength(2);
      expect(data.recentFeedback[0].action).toBe("LIKE");
      expect(data.recentFeedback[0].titleName).toBe("Dune");
    });

    it("returns error result on DB failure", async () => {
      const prisma = {
        profile: {
          findUnique: vi.fn(async () => {
            throw new Error("connection refused");
          }),
        },
        subscription: { findMany: vi.fn() },
        feedback: { findMany: vi.fn() },
      } as any;

      const result = await executePreferences(makeInput(), { prisma });
      expect(result.success).toBe(false);
      expect(result.error).toContain("connection refused");
    });
  });

  // ---------- buildPreferencesPromptContext ----------

  describe("buildPreferencesPromptContext", () => {
    it("formats cold-start context", () => {
      const prefs: ProfilePreferences = {
        preferences: { genres: [], moods: [], avoidGenres: [] },
        subscriptions: [],
        region: "US",
        recentFeedback: [],
        coldStart: true,
      };
      const ctx = buildPreferencesPromptContext(prefs);
      expect(ctx).toContain("cold-start");
      expect(ctx).toContain("Region: US");
    });

    it("includes genres and subscriptions", () => {
      const prefs: ProfilePreferences = {
        preferences: {
          genres: ["Sci-Fi", "Action"],
          moods: ["dark"],
          avoidGenres: ["Horror"],
        },
        subscriptions: ["netflix", "hulu"],
        region: "US",
        recentFeedback: [],
        coldStart: false,
      };
      const ctx = buildPreferencesPromptContext(prefs);
      expect(ctx).toContain("Preferred genres: Sci-Fi, Action");
      expect(ctx).toContain("Preferred moods: dark");
      expect(ctx).toContain("Avoids: Horror");
      expect(ctx).toContain("Subscriptions: netflix, hulu");
    });

    it("includes recently liked titles", () => {
      const prefs: ProfilePreferences = {
        preferences: { genres: [], moods: [], avoidGenres: [] },
        subscriptions: [],
        region: "GB",
        recentFeedback: [
          { titleId: "t1", action: "LIKE", titleName: "Dune", genres: [] },
          { titleId: "t2", action: "DISLIKE", titleName: "Bad Movie", genres: [] },
          { titleId: "t3", action: "LIKE", titleName: "Arrival", genres: [] },
        ],
        coldStart: false,
      };
      const ctx = buildPreferencesPromptContext(prefs);
      expect(ctx).toContain("Recently liked: Dune, Arrival");
      expect(ctx).not.toContain("Bad Movie");
    });
  });
});
