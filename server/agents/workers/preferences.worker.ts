/**
 * Preferences Worker Agent
 * Epic 8: AI & Social — User preferences and cold-start data
 *
 * Retrieves user preferences, subscriptions, and feedback from Prisma.
 * Provides context for personalized recommendations.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  WorkerInput,
  WorkerResult,
  UserPreferences,
} from "../types";
import { createLogger } from "../../common/logger";

const logger = createLogger("preferences-worker");

export interface PreferencesWorkerDeps {
  prisma: PrismaClient;
}

export interface ProfilePreferences {
  preferences: UserPreferences;
  subscriptions: string[];
  region: string;
  recentFeedback: FeedbackSummary[];
  coldStart: boolean;
}

export interface FeedbackSummary {
  titleId: string;
  action: "LIKE" | "DISLIKE" | "SAVE";
  titleName?: string;
  genres?: string[];
}

export async function executePreferences(
  input: WorkerInput,
  deps: PreferencesWorkerDeps
): Promise<WorkerResult> {
  const start = Date.now();

  try {
    const { context } = input;
    const profileId = context.profileId;

    if (!profileId) {
      return {
        worker: "preferences",
        success: true,
        data: buildColdStartPreferences(),
        latencyMs: Date.now() - start,
      };
    }

    const prefs = await loadProfilePreferences(profileId, deps.prisma);

    return {
      worker: "preferences",
      success: true,
      data: prefs,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Preferences worker failed", { error: msg });
    return {
      worker: "preferences",
      success: false,
      error: msg,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Load Profile Preferences from DB
// ============================================================================

async function loadProfilePreferences(
  profileId: string,
  prisma: PrismaClient
): Promise<ProfilePreferences> {
  // Fetch profile, subscriptions, and recent feedback in parallel
  const [profile, subscriptions, recentFeedback] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        preferences: true,
        locale: true,
        user: { select: { region: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { profileId, active: true },
      select: { service: true, region: true },
    }),
    prisma.feedback.findMany({
      where: { profileId },
      orderBy: { ts: "desc" },
      take: 20,
      select: {
        titleId: true,
        action: true,
        title: { select: { name: true, genres: true } },
      },
    }),
  ]);

  const services = subscriptions.map((s) => s.service);
  const coldStart = services.length === 0;

  // Extract preferences from profile JSON field
  const rawPrefs = (profile?.preferences as Record<string, unknown>) || {};
  const preferences = parsePreferences(rawPrefs);

  // Infer preferences from feedback if explicit prefs are sparse
  if (preferences.genres.length === 0 && recentFeedback.length > 0) {
    const inferredGenres = inferGenresFromFeedback(recentFeedback);
    preferences.genres = inferredGenres;
  }

  // Derive region
  const region = deriveRegion(profile?.locale, profile?.user?.region);

  const feedbackSummary: FeedbackSummary[] = recentFeedback.map((f) => ({
    titleId: f.titleId,
    action: f.action as FeedbackSummary["action"],
    titleName: f.title?.name,
    genres: f.title?.genres || [],
  }));

  return {
    preferences,
    subscriptions: services,
    region,
    recentFeedback: feedbackSummary,
    coldStart,
  };
}

// ============================================================================
// Preference Parsing
// ============================================================================

function parsePreferences(raw: Record<string, unknown>): UserPreferences {
  return {
    genres: asStringArray(raw.genres),
    moods: asStringArray(raw.moods),
    avoidGenres: asStringArray(raw.avoidGenres),
    minRating:
      typeof raw.minRating === "number" ? raw.minRating : undefined,
    preferredDuration: parseDuration(raw.preferredDuration),
  };
}

function parseDuration(
  raw: unknown
): { min?: number; max?: number } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  return {
    min: typeof d.min === "number" ? d.min : undefined,
    max: typeof d.max === "number" ? d.max : undefined,
  };
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

// ============================================================================
// Genre Inference from Feedback
// ============================================================================

function inferGenresFromFeedback(
  feedback: Array<{
    action: string;
    title?: { genres?: string[] } | null;
  }>
): string[] {
  const genreCounts = new Map<string, number>();

  for (const f of feedback) {
    if (f.action !== "LIKE" && f.action !== "SAVE") continue;
    const genres = f.title?.genres || [];
    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
  }

  // Reduce weight for disliked genres
  for (const f of feedback) {
    if (f.action !== "DISLIKE") continue;
    const genres = f.title?.genres || [];
    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) || 0) - 1);
    }
  }

  // Return top genres by count
  return Array.from(genreCounts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);
}

// ============================================================================
// Region Derivation
// ============================================================================

function deriveRegion(
  locale?: string | null,
  userRegion?: string | null
): string {
  if (userRegion) return userRegion;
  if (locale) {
    const parts = locale.split("-");
    if (parts.length > 1 && parts[1]) return parts[1];
  }
  return "US";
}

// ============================================================================
// Cold-Start Defaults
// ============================================================================

function buildColdStartPreferences(): ProfilePreferences {
  return {
    preferences: {
      genres: [],
      moods: [],
      avoidGenres: [],
    },
    subscriptions: [],
    region: "US",
    recentFeedback: [],
    coldStart: true,
  };
}

// ============================================================================
// Exported Utilities
// ============================================================================

export function buildPreferencesPromptContext(
  prefs: ProfilePreferences
): string {
  const parts: string[] = [];

  if (prefs.coldStart) {
    parts.push("New user (cold-start): no established preferences yet.");
  }

  if (prefs.preferences.genres.length > 0) {
    parts.push(`Preferred genres: ${prefs.preferences.genres.join(", ")}`);
  }
  if (prefs.preferences.moods.length > 0) {
    parts.push(`Preferred moods: ${prefs.preferences.moods.join(", ")}`);
  }
  if (prefs.preferences.avoidGenres.length > 0) {
    parts.push(`Avoids: ${prefs.preferences.avoidGenres.join(", ")}`);
  }
  if (prefs.subscriptions.length > 0) {
    parts.push(`Subscriptions: ${prefs.subscriptions.join(", ")}`);
  }
  if (prefs.region) {
    parts.push(`Region: ${prefs.region}`);
  }

  // Summarize recent activity
  const likes = prefs.recentFeedback.filter((f) => f.action === "LIKE");
  if (likes.length > 0) {
    const titles = likes
      .slice(0, 3)
      .map((f) => f.titleName)
      .filter(Boolean);
    if (titles.length > 0) {
      parts.push(`Recently liked: ${titles.join(", ")}`);
    }
  }

  return parts.join("\n");
}
