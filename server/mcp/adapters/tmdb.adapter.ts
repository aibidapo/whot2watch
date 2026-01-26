/**
 * TMDB MCP Adapter
 * Epic 1/8: Data Model & AI — TMDB integration via MCP
 *
 * Wraps MCPClient for TMDB-specific operations. Maps TMDB tool results
 * to internal TitleResult types. Falls back gracefully on failure.
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { TitleResult, MCPToolResult } from "../../agents/types";
import type { MCPClient } from "../client";
import { createLogger } from "../../common/logger";

const logger = createLogger("tmdb-adapter");

const SERVER_NAME = "tmdb";

export interface TMDBAdapterDeps {
  mcpClient: MCPClient;
}

// ============================================================================
// TMDB Adapter
// ============================================================================

export class TMDBAdapter {
  private mcpClient: MCPClient;

  constructor(deps: TMDBAdapterDeps) {
    this.mcpClient = deps.mcpClient;
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  async searchTitles(
    query: string,
    options?: { type?: "movie" | "tv"; year?: number; region?: string }
  ): Promise<TitleResult[]> {
    const toolName = options?.type === "tv" ? "search_tv" : "search_movies";
    const args: Record<string, unknown> = { query };
    if (options?.year) args.year = options.year;
    if (options?.region) args.region = options.region;

    const result = await this.callTMDB(toolName, args);
    if (!result.success || !result.data) return [];

    return mapTMDBResults(result.data);
  }

  /**
   * Multi-search: searches movies, TV shows, and people in one call.
   */
  async multiSearch(query: string): Promise<TitleResult[]> {
    const result = await this.callTMDB("multi_search", { query });
    if (!result.success || !result.data) return [];

    return mapTMDBResults(result.data);
  }

  // --------------------------------------------------------------------------
  // Title Details
  // --------------------------------------------------------------------------

  async getTitleDetails(
    tmdbId: number,
    type: "movie" | "tv"
  ): Promise<TitleResult | null> {
    const toolName = type === "tv" ? "get_tv_details" : "get_movie_details";
    const result = await this.callTMDB(toolName, { id: tmdbId });
    if (!result.success || !result.data) return null;

    const mapped = mapSingleTMDBResult(result.data, type);
    return mapped;
  }

  // --------------------------------------------------------------------------
  // Trending
  // --------------------------------------------------------------------------

  async getTrending(
    timeWindow: "day" | "week" = "week",
    mediaType: "movie" | "tv" | "all" = "all"
  ): Promise<TitleResult[]> {
    const result = await this.callTMDB("get_trending", {
      time_window: timeWindow,
      media_type: mediaType,
    });
    if (!result.success || !result.data) return [];

    return mapTMDBResults(result.data);
  }

  // --------------------------------------------------------------------------
  // Recommendations (TMDB's "similar" or "recommendations" endpoint)
  // --------------------------------------------------------------------------

  async getRecommendations(
    tmdbId: number,
    type: "movie" | "tv"
  ): Promise<TitleResult[]> {
    const toolName =
      type === "tv" ? "get_tv_recommendations" : "get_movie_recommendations";
    const result = await this.callTMDB(toolName, { id: tmdbId });
    if (!result.success || !result.data) return [];

    return mapTMDBResults(result.data);
  }

  // --------------------------------------------------------------------------
  // Discover (filtered browsing)
  // --------------------------------------------------------------------------

  async discover(options: {
    type: "movie" | "tv";
    genres?: number[];
    yearMin?: number;
    yearMax?: number;
    minVoteAverage?: number;
    sortBy?: string;
    region?: string;
  }): Promise<TitleResult[]> {
    const toolName = options.type === "tv" ? "discover_tv" : "discover_movies";
    const args: Record<string, unknown> = {};

    if (options.genres?.length) args.with_genres = options.genres.join(",");
    if (options.yearMin) args["primary_release_date.gte"] = `${options.yearMin}-01-01`;
    if (options.yearMax) args["primary_release_date.lte"] = `${options.yearMax}-12-31`;
    if (options.minVoteAverage) args["vote_average.gte"] = options.minVoteAverage;
    if (options.sortBy) args.sort_by = options.sortBy;
    if (options.region) args.region = options.region;

    const result = await this.callTMDB(toolName, args);
    if (!result.success || !result.data) return [];

    return mapTMDBResults(result.data);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private async callTMDB(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    try {
      return await this.mcpClient.callTool(SERVER_NAME, {
        name: toolName,
        arguments: args,
      });
    } catch (error) {
      logger.error(`TMDB tool call failed: ${toolName}`, {
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }
}

// ============================================================================
// TMDB → TitleResult Mapping
// ============================================================================

interface TMDBItem {
  id?: number;
  title?: string;
  name?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  popularity?: number;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export function mapTMDBResults(data: unknown): TitleResult[] {
  // Handle paginated response { results: [...] } or direct array
  const items = Array.isArray(data)
    ? (data as TMDBItem[])
    : ((data as Record<string, unknown>)?.results as TMDBItem[] | undefined) ||
      [];

  return items
    .filter((item) => item.id && (item.title || item.name))
    .map((item) => mapSingleTMDBResult(item, inferType(item)))
    .filter((r): r is TitleResult => r !== null);
}

export function mapSingleTMDBResult(
  data: unknown,
  type: "movie" | "tv"
): TitleResult | null {
  const item = data as TMDBItem;
  if (!item.id) return null;

  const name = item.title || item.name;
  if (!name) return null;

  const dateStr = item.release_date || item.first_air_date;
  const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined;

  const runtime =
    item.runtime ||
    (item.episode_run_time?.length ? item.episode_run_time[0] : undefined);

  // Genre IDs → names (subset of known TMDB genres)
  const genres = item.genres
    ? item.genres.map((g) => g.name)
    : (item.genre_ids || []).map((id) => TMDB_GENRE_MAP[id] || "").filter(Boolean);

  const result: TitleResult = { id: `tmdb-${item.id}`, type, name, genres, moods: [] };

  if (item.id) result.tmdbId = item.id;
  if (releaseYear && !isNaN(releaseYear)) result.releaseYear = releaseYear;
  if (runtime) result.runtimeMin = runtime;
  if (item.vote_average != null) result.voteAverage = item.vote_average;
  if (item.popularity != null) result.popularity = item.popularity;
  if (item.poster_path) result.posterUrl = `${TMDB_IMAGE_BASE}${item.poster_path}`;
  if (item.backdrop_path) result.backdropUrl = `${TMDB_IMAGE_BASE}${item.backdrop_path}`;

  return result;
}

function inferType(item: TMDBItem): "movie" | "tv" {
  if (item.media_type === "tv") return "tv";
  if (item.media_type === "movie") return "movie";
  // Heuristic: TV shows have `name` and `first_air_date`, movies have `title`
  if (item.first_air_date && !item.title) return "tv";
  return "movie";
}

/** Subset of TMDB genre IDs → names for genre_ids mapping */
const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  // TV-specific
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};
