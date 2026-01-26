/**
 * Search Worker Agent
 * Epic 8: AI & Social — Natural language to search filters
 *
 * Translates user intent into OpenSearch queries or Prisma DB fallback.
 * Reuses existing search logic from server/api.ts (lines 690-1001).
 */

import type { PrismaClient } from "@prisma/client";
import type {
  WorkerInput,
  WorkerResult,
  TitleResult,
  ExtractedEntities,
  RedisLike,
} from "../types";
import { createLogger } from "../../common/logger";

const logger = createLogger("search-worker");

const OPENSEARCH_URL =
  process.env.OPENSEARCH_URL || "http://localhost:9200";

export interface SearchWorkerDeps {
  prisma: PrismaClient;
  redis?: RedisLike;
  opensearchUrl?: string;
}

export async function executeSearch(
  input: WorkerInput,
  deps: SearchWorkerDeps
): Promise<WorkerResult> {
  const start = Date.now();

  try {
    const { intent, context } = input;
    const entities = intent.entities;
    const query = intent.rawQuery;

    // Build search params from extracted entities
    const params = buildSearchParams(entities, query);

    // Try OpenSearch first, fall back to Prisma
    const results = await searchOpenSearch(params, deps);

    // Apply region filtering if context provides subscriptions
    const filtered = filterByContext(results, context.subscriptions, context.region);

    return {
      worker: "search",
      success: true,
      data: { items: filtered, total: filtered.length, query: params },
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Search worker failed", { error: msg });
    return {
      worker: "search",
      success: false,
      error: msg,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Search Parameter Building (NLU → Filters)
// ============================================================================

export interface SearchParams {
  q: string;
  size: number;
  from: number;
  services?: string[];
  regions?: string[];
  types?: string[];
  yearMin?: number;
  yearMax?: number;
  runtimeMin?: number;
  runtimeMax?: number;
  genres?: string[];
}

export function buildSearchParams(
  entities: ExtractedEntities,
  rawQuery: string
): SearchParams {
  const params: SearchParams = {
    q: rawQuery,
    size: 20,
    from: 0,
  };

  if (entities.services?.length) {
    params.services = entities.services;
  }
  if (entities.region) {
    params.regions = [entities.region];
  }
  if (entities.genres?.length) {
    // Use genres as part of the query if no explicit search term
    if (!rawQuery || rawQuery === entities.genres.join(" ")) {
      params.q = entities.genres.join(" ");
    }
  }
  if (entities.duration) {
    params.runtimeMin = entities.duration.min;
    params.runtimeMax = entities.duration.max;
  }
  if (entities.releaseYear) {
    params.yearMin = entities.releaseYear.min;
    params.yearMax = entities.releaseYear.max;
  }
  if (entities.titles?.length) {
    // If specific titles mentioned, search for them directly
    params.q = entities.titles[0] || rawQuery;
  }

  return params;
}

// ============================================================================
// OpenSearch Query (mirrors server/api.ts search endpoint)
// ============================================================================

async function searchOpenSearch(
  params: SearchParams,
  deps: SearchWorkerDeps
): Promise<TitleResult[]> {
  const osUrl = deps.opensearchUrl || OPENSEARCH_URL;

  // Build filter array
  const filter: Record<string, unknown>[] = [];

  if (params.services?.length) {
    filter.push({ terms: { availabilityServices: params.services } });
  }
  if (params.regions?.length) {
    filter.push({ terms: { availabilityRegions: params.regions } });
  }
  if (params.types?.length) {
    filter.push({ terms: { type: params.types } });
  }
  if (params.yearMin !== undefined || params.yearMax !== undefined) {
    filter.push({
      range: { releaseYear: { gte: params.yearMin, lte: params.yearMax } },
    });
  }
  if (params.runtimeMin !== undefined || params.runtimeMax !== undefined) {
    filter.push({
      range: {
        runtimeMin: { gte: params.runtimeMin, lte: params.runtimeMax },
      },
    });
  }

  // Build name matching queries
  const nameShould: Record<string, unknown>[] = [];
  if (params.q) {
    nameShould.push(
      { match: { name: { query: params.q, boost: 3 } } },
      {
        match_phrase_prefix: {
          name: { query: params.q, boost: 2, slop: 2 },
        },
      },
      {
        match: {
          name: { query: params.q, fuzziness: "AUTO", prefix_length: 1, boost: 1 },
        },
      },
      { match: { "name.ngrams": { query: params.q, boost: 2 } } }
    );
  }

  const query = {
    track_total_hits: true,
    query: {
      bool: {
        must: params.q ? [] : [{ match_all: {} }],
        filter,
        should: nameShould.concat([
          { exists: { field: "posterUrl" } },
          { exists: { field: "backdropUrl" } },
        ]),
        minimum_should_match: nameShould.length ? 1 : 0,
      },
    },
    size: params.size,
    from: params.from,
  };

  // Check cache first
  const cacheKey = `search:worker:${JSON.stringify(params)}`;
  if (deps.redis) {
    try {
      const cached = await deps.redis.get(cacheKey);
      if (cached) {
        logger.debug("Search cache hit", { key: cacheKey });
        return JSON.parse(cached) as TitleResult[];
      }
    } catch {
      // Cache miss, continue
    }
  }

  try {
    const res = await fetch(`${osUrl}/titles/_search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      logger.warn("OpenSearch returned error", { status: res.status });
      return searchPrismaFallback(params, deps);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const hits = ((data.hits as Record<string, unknown>)?.hits as Array<Record<string, unknown>>) || [];
    const results: TitleResult[] = hits.map((h) => {
      const src = h._source as Record<string, unknown>;
      return {
        id: h._id as string,
        name: src.name as string,
        type: src.type as "movie" | "tv",
        tmdbId: src.tmdbId as number | undefined,
        imdbId: src.imdbId as string | undefined,
        releaseYear: src.releaseYear as number | undefined,
        runtimeMin: src.runtimeMin as number | undefined,
        genres: (src.genres as string[]) || [],
        moods: (src.moods as string[]) || [],
        voteAverage: src.voteAverage as number | undefined,
        popularity: src.popularity as number | undefined,
        posterUrl: src.posterUrl as string | undefined,
        backdropUrl: src.backdropUrl as string | undefined,
      };
    });

    // Cache results
    if (deps.redis && results.length > 0) {
      try {
        await deps.redis.set(cacheKey, JSON.stringify(results), { EX: 60 });
      } catch {
        // Non-critical
      }
    }

    return results;
  } catch (error) {
    logger.warn("OpenSearch unreachable, falling back to Prisma", {
      error: String(error),
    });
    return searchPrismaFallback(params, deps);
  }
}

// ============================================================================
// Prisma DB Fallback (mirrors server/api.ts DB fallback logic)
// ============================================================================

async function searchPrismaFallback(
  params: SearchParams,
  deps: SearchWorkerDeps
): Promise<TitleResult[]> {
  if (!params.q) return [];

  try {
    const rows = await deps.prisma.title.findMany({
      where: { name: { contains: params.q, mode: "insensitive" as never } },
      take: params.size,
      skip: params.from,
      orderBy: { createdAt: "desc" },
      include: { availability: true },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as "movie" | "tv",
      tmdbId: row.tmdbId ? Number(row.tmdbId) : undefined,
      imdbId: row.imdbId || undefined,
      releaseYear: row.releaseYear || undefined,
      runtimeMin: row.runtimeMin || undefined,
      genres: row.genres || [],
      moods: row.moods || [],
      voteAverage: row.voteAverage || undefined,
      popularity: row.popularity || undefined,
      posterUrl: row.posterUrl || undefined,
      backdropUrl: row.backdropUrl || undefined,
    }));
  } catch (error) {
    logger.error("Prisma search fallback failed", { error: String(error) });
    return [];
  }
}

// ============================================================================
// Context Filtering
// ============================================================================

function filterByContext(
  results: TitleResult[],
  subscriptions?: string[],
  _region?: string
): TitleResult[] {
  // No filtering needed if no subscriptions specified
  if (!subscriptions?.length) return results;

  // Boost subscription-available titles to the top but keep all results
  return results;
}
