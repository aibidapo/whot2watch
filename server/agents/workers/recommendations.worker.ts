/**
 * Recommendations Worker Agent
 * Epic 8: AI & Social — Scoring, diversity, and explanation generation
 *
 * Produces personalized recommendations with reasons.
 * Reuses scoring/diversity logic from server/api.ts picks endpoint (lines 1423-1848).
 */

import type { PrismaClient } from "@prisma/client";
import type {
  WorkerInput,
  WorkerResult,
  TitleResult,
  RecommendationResult,
  AvailabilityResult,
  RedisLike,
} from "../types";
import type { ProfilePreferences } from "./preferences.worker";
import { createLogger } from "../../common/logger";

const logger = createLogger("recommendations-worker");

export interface RecommendationsWorkerDeps {
  prisma: PrismaClient;
  redis?: RedisLike;
}

export async function executeRecommendations(
  input: WorkerInput,
  deps: RecommendationsWorkerDeps
): Promise<WorkerResult> {
  const start = Date.now();

  try {
    const { context, previousResults } = input;
    const profileId = context.profileId;

    // Gather inputs from previous worker results
    const searchResults = extractSearchResults(previousResults);
    const preferences = extractPreferences(previousResults);
    const region = preferences?.region || context.region || "US";
    const subscriptions =
      preferences?.subscriptions || context.subscriptions || [];

    let candidates: ScoredCandidate[];

    if (searchResults.length > 0) {
      // Score search results against preferences
      candidates = await scoreSearchResults(
        searchResults,
        subscriptions,
        region,
        preferences,
        deps
      );
    } else {
      // Generate recommendations from scratch (picks-style)
      candidates = await generatePicksCandidates(
        profileId,
        subscriptions,
        region,
        preferences,
        deps
      );
    }

    // Apply diversity sampling
    const diverse = diversityPick(candidates, 6);

    // Build recommendation results with reasons
    const recommendations: RecommendationResult[] = diverse.map((c) => {
      const rec: RecommendationResult = {
        title: c.title,
        score: c.score,
        reason: c.reason,
      };
      if (c.availability) rec.availability = c.availability as AvailabilityResult[];
      if (c.matchedPreferences) rec.matchedPreferences = c.matchedPreferences;
      return rec;
    });

    return {
      worker: "recommendations",
      success: true,
      data: { items: recommendations },
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Recommendations worker failed", { error: msg });
    return {
      worker: "recommendations",
      success: false,
      error: msg,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Scoring (mirrors server/api.ts picks scoring)
// ============================================================================

interface ScoredCandidate {
  title: TitleResult;
  score: number;
  reason: string;
  availability?: { service: string; region: string; offerType: string }[];
  matchedPreferences: string[];
}

interface TitleWithRatings extends TitleResult {
  ratingsImdb?: number;
  ratingsRottenTomatoes?: number;
  ratingsMetacritic?: number;
  trendingDay?: number;
  trendingWeek?: number;
  availability?: { service: string; region: string; offerType: string }[];
}

function scoreTitleForUser(
  t: TitleWithRatings,
  subscriptions: string[],
  region: string,
  prefs: ProfilePreferences | undefined,
  coldStart: boolean
): { score: number; matchedPrefs: string[]; reason: string } {
  let s = 0;
  const matchedPrefs: string[] = [];
  const reasonBits: string[] = [];

  // Availability boost
  const availMatch = (t.availability || []).some(
    (a) => subscriptions.includes(a.service) && a.region === region
  );
  if (availMatch) {
    s += 2.5;
    const svc = (t.availability || []).find((a) => subscriptions.includes(a.service));
    if (svc) reasonBits.push(`on ${svc.service}`);
  }

  // Vote average (normalized 0..1)
  if (typeof t.voteAverage === "number") {
    s += (Math.min(Math.max(t.voteAverage, 0), 10) / 10) * (coldStart ? 1.5 : 1);
    if (t.voteAverage >= 8.5) reasonBits.push("highly rated");
  }

  // External ratings composite
  const ratings = {
    imdb: t.ratingsImdb,
    rt: t.ratingsRottenTomatoes,
    mc: t.ratingsMetacritic,
  };
  let comp = 0;
  let w = 0;
  if (typeof ratings.imdb === "number") { comp += ratings.imdb * 0.6; w += 0.6; }
  if (typeof ratings.rt === "number") { comp += ratings.rt * 0.3; w += 0.3; }
  if (typeof ratings.mc === "number") { comp += ratings.mc * 0.1; w += 0.1; }
  if (w > 0) {
    const normalized = comp / w / 100;
    s += normalized * (coldStart ? 2 : 1);
    const best = Math.max(ratings.imdb || 0, ratings.rt || 0, ratings.mc || 0);
    if (best >= 85) reasonBits.push("critically acclaimed");
    else if (best >= 75) reasonBits.push("well reviewed");
  }

  // Popularity boost
  if (typeof t.popularity === "number") {
    s += (Math.min(Math.max(t.popularity, 0), 1000) / 10000) * (coldStart ? 2 : 1);
    if (t.popularity >= 300) reasonBits.push("popular now");
  }

  // Trending boost
  const day = t.trendingDay || 0;
  const week = t.trendingWeek || 0;
  const trendComposite = day * 0.5 + week * 0.5;
  if (trendComposite > 0) {
    s += trendComposite * (coldStart ? 1.5 : 0.8);
    if (day >= 0.6) reasonBits.push("trending today");
    else if (week >= 0.6) reasonBits.push("trending");
  }

  // Genre match
  if (prefs && prefs.preferences.genres.length > 0) {
    const matched = t.genres.filter((g) =>
      prefs.preferences.genres.includes(g)
    );
    if (matched.length > 0) {
      s += matched.length * 0.5;
      matchedPrefs.push(...matched.map((g) => `genre:${g}`));
    }
    // Penalize avoided genres
    const avoided = t.genres.filter((g) =>
      prefs.preferences.avoidGenres.includes(g)
    );
    if (avoided.length > 0) {
      s -= avoided.length * 1.0;
    }
  }

  // Recency bias
  if (t.releaseYear) {
    s += Math.max(0, t.releaseYear - 2000) / 200;
    if (t.releaseYear >= new Date().getFullYear() - 1) reasonBits.push("new");
  }

  // Imagery presence
  if (t.posterUrl || t.backdropUrl) s += 0.2;

  const reason =
    reasonBits.length > 0
      ? `Because it ${reasonBits.join(" • ")} in ${region}`
      : coldStart
        ? "Quality blend pick"
        : `Matches your services in ${region}`;

  return { score: s, matchedPrefs, reason };
}

// ============================================================================
// Score search results
// ============================================================================

async function scoreSearchResults(
  results: TitleResult[],
  subscriptions: string[],
  region: string,
  prefs: ProfilePreferences | undefined,
  deps: RecommendationsWorkerDeps
): Promise<ScoredCandidate[]> {
  const coldStart = !subscriptions.length;
  const titleIds = results.map((t) => t.id);

  // Fetch external ratings and availability
  const [extRatings, availability] = await Promise.all([
    deps.prisma.externalRating.findMany({
      where: { titleId: { in: titleIds } },
      select: { titleId: true, source: true, valueNum: true },
    }),
    deps.prisma.availability.findMany({
      where: { titleId: { in: titleIds }, region },
      select: { titleId: true, service: true, region: true, offerType: true },
    }),
  ]);

  // Index by title
  const ratingsMap = new Map<string, Record<string, number>>();
  for (const r of extRatings) {
    const key = r.source.toUpperCase();
    if (typeof r.valueNum !== "number") continue;
    const entry = ratingsMap.get(r.titleId) || {};
    entry[key] = r.valueNum;
    ratingsMap.set(r.titleId, entry);
  }

  const availMap = new Map<string, typeof availability>();
  for (const a of availability) {
    const list = availMap.get(a.titleId) || [];
    list.push(a);
    availMap.set(a.titleId, list);
  }

  return results.map((t) => {
    const ratings = ratingsMap.get(t.id) || {};
    const avail = availMap.get(t.id) || [];
    const enriched: TitleWithRatings = {
      ...t,
      availability: avail,
    };
    if (ratings.IMDB != null) enriched.ratingsImdb = ratings.IMDB;
    if (ratings.ROTTEN_TOMATOES != null) enriched.ratingsRottenTomatoes = ratings.ROTTEN_TOMATOES;
    if (ratings.METACRITIC != null) enriched.ratingsMetacritic = ratings.METACRITIC;
    const { score, matchedPrefs, reason } = scoreTitleForUser(
      enriched,
      subscriptions,
      region,
      prefs,
      coldStart
    );
    return {
      title: t,
      score,
      reason,
      availability: avail,
      matchedPreferences: matchedPrefs,
    };
  }).sort((a, b) => b.score - a.score);
}

// ============================================================================
// Generate picks from scratch (when no search results)
// ============================================================================

async function generatePicksCandidates(
  profileId: string | undefined,
  subscriptions: string[],
  region: string,
  prefs: ProfilePreferences | undefined,
  deps: RecommendationsWorkerDeps
): Promise<ScoredCandidate[]> {
  const coldStart = !subscriptions.length;

  // Fetch top candidates by popularity
  const titles = await deps.prisma.title.findMany({
    take: 200,
    orderBy: [{ popularity: "desc" }, { createdAt: "desc" }],
    where: {
      OR: [
        { imdbId: { not: null } },
        { externalRatings: { some: {} } },
        { popularity: { gt: 0 } },
      ],
    },
    include: { availability: true },
  });

  const titleIds = titles.map((t) => t.id);

  const [extRatings, trendingSignals] = await Promise.all([
    deps.prisma.externalRating.findMany({
      where: { titleId: { in: titleIds } },
      select: { titleId: true, source: true, valueNum: true },
    }),
    (deps.prisma as unknown as Record<string, unknown>).trendingSignal
      ? (deps.prisma as any).trendingSignal.findMany({
          where: { titleId: { in: titleIds } },
          select: { titleId: true, source: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  // Index ratings
  const ratingsMap = new Map<string, Record<string, number>>();
  for (const r of extRatings) {
    const key = r.source.toUpperCase();
    if (typeof r.valueNum !== "number") continue;
    const entry = ratingsMap.get(r.titleId) || {};
    entry[key] = r.valueNum;
    ratingsMap.set(r.titleId, entry);
  }

  // Index trending
  const trendingMap = new Map<string, { day?: number; week?: number }>();
  for (const s of trendingSignals as Array<{ titleId: string; source: string; value: number }>) {
    const src = s.source.toUpperCase();
    const entry = trendingMap.get(s.titleId) || {};
    if (src === "TMDB_DAY") { entry.day = s.value; }
    else if (src === "TMDB_WEEK") { entry.week = s.value; }
    trendingMap.set(s.titleId, entry);
  }

  return titles.map((t) => {
    const ratings = ratingsMap.get(t.id) || {};
    const trending = trendingMap.get(t.id) || {};
    const enriched: TitleWithRatings = {
      id: t.id,
      name: t.name,
      type: t.type as "movie" | "tv",
      genres: t.genres || [],
      moods: t.moods || [],
      availability: (t.availability || []).map((a) => ({
        service: a.service,
        region: a.region,
        offerType: a.offerType,
      })),
    };
    if (t.tmdbId) enriched.tmdbId = Number(t.tmdbId);
    if (t.imdbId) enriched.imdbId = t.imdbId;
    if (t.releaseYear) enriched.releaseYear = t.releaseYear;
    if (t.runtimeMin) enriched.runtimeMin = t.runtimeMin;
    if (t.voteAverage) enriched.voteAverage = t.voteAverage;
    if (t.popularity) enriched.popularity = t.popularity;
    if (t.posterUrl) enriched.posterUrl = t.posterUrl;
    if (t.backdropUrl) enriched.backdropUrl = t.backdropUrl;
    if (ratings.IMDB != null) enriched.ratingsImdb = ratings.IMDB;
    if (ratings.ROTTEN_TOMATOES != null) enriched.ratingsRottenTomatoes = ratings.ROTTEN_TOMATOES;
    if (ratings.METACRITIC != null) enriched.ratingsMetacritic = ratings.METACRITIC;
    if (trending.day != null) enriched.trendingDay = trending.day;
    if (trending.week != null) enriched.trendingWeek = trending.week;
    const { score, matchedPrefs, reason } = scoreTitleForUser(
      enriched,
      subscriptions,
      region,
      prefs,
      coldStart
    );
    const title: TitleResult = {
      id: t.id,
      name: t.name,
      type: t.type as "movie" | "tv",
      genres: t.genres || [],
      moods: t.moods || [],
    };
    if (t.releaseYear) title.releaseYear = t.releaseYear;
    if (t.posterUrl) title.posterUrl = t.posterUrl;
    if (t.backdropUrl) title.backdropUrl = t.backdropUrl;
    if (t.voteAverage) title.voteAverage = t.voteAverage;
    if (t.popularity) title.popularity = t.popularity;
    const candidate: ScoredCandidate = {
      title,
      score,
      reason,
      matchedPreferences: matchedPrefs,
    };
    if (enriched.availability) candidate.availability = enriched.availability;
    return candidate;
  }).sort((a, b) => b.score - a.score);
}

// ============================================================================
// Diversity Sampling (mirrors server/api.ts diversityPick)
// ============================================================================

function bucketOf(t: TitleResult): string {
  return String((t.name || "").toLowerCase())
    .replace(/\s+(part|season|volume|vol\.?|chapter)\s*\d+.*/i, "")
    .trim() || "unknown";
}

function diversityPick(
  candidates: ScoredCandidate[],
  limit: number
): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  const counts: Record<string, number> = {};
  const seenSeries = new Set<string>();
  const maxPerBucket = 2;

  for (const c of candidates) {
    if (selected.length >= limit) break;
    const bucket = bucketOf(c.title);
    counts[bucket] = counts[bucket] || 0;

    if (counts[bucket] < maxPerBucket && !seenSeries.has(bucket)) {
      selected.push(c);
      counts[bucket]++;
      seenSeries.add(bucket);
    }
  }

  // Fill remainder
  if (selected.length < limit) {
    for (const c of candidates) {
      if (selected.length >= limit) break;
      const bucket = bucketOf(c.title);
      if (!selected.includes(c) && !seenSeries.has(bucket)) {
        selected.push(c);
        seenSeries.add(bucket);
      }
    }
  }

  return selected.slice(0, limit);
}

// ============================================================================
// Extract Results from Previous Workers
// ============================================================================

function extractSearchResults(
  previousResults?: WorkerResult[]
): TitleResult[] {
  if (!previousResults) return [];
  const searchResult = previousResults.find((r) => r.worker === "search" && r.success);
  if (!searchResult?.data) return [];
  const data = searchResult.data as { items?: TitleResult[] };
  return data.items || [];
}

function extractPreferences(
  previousResults?: WorkerResult[]
): ProfilePreferences | undefined {
  if (!previousResults) return undefined;
  const prefsResult = previousResults.find((r) => r.worker === "preferences" && r.success);
  if (!prefsResult?.data) return undefined;
  return prefsResult.data as ProfilePreferences;
}
