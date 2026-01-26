import { describe, it, expect, vi, beforeEach } from "vitest";
import { TMDBAdapter, mapTMDBResults, mapSingleTMDBResult } from "./tmdb.adapter";
import type { MCPClient } from "../client";

// ---------------------------------------------------------------------------
// Mock MCPClient
// ---------------------------------------------------------------------------

function makeMCPClient(
  callToolResult?: { success: boolean; data?: unknown; error?: string }
): MCPClient {
  return {
    callTool: vi.fn(async () => callToolResult || { success: true, data: sampleSearchResponse }),
    registerServer: vi.fn(),
    getServer: vi.fn(async () => undefined),
    getRegisteredServers: vi.fn(() => []),
    getActiveServers: vi.fn(() => []),
    isServerReady: vi.fn(() => true),
    shutdownServer: vi.fn(async () => {}),
    shutdownAll: vi.fn(async () => {}),
    invalidateCache: vi.fn(async () => {}),
  } as unknown as MCPClient;
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const sampleTMDBMovie = {
  id: 438631,
  title: "Dune",
  release_date: "2021-09-15",
  runtime: 155,
  genre_ids: [878, 12],
  vote_average: 7.8,
  popularity: 120.5,
  poster_path: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  backdrop_path: "/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg",
};

const sampleTMDBTV = {
  id: 1399,
  name: "Breaking Bad",
  first_air_date: "2008-01-20",
  episode_run_time: [47],
  genre_ids: [18, 80],
  vote_average: 8.9,
  popularity: 200,
  poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  media_type: "tv",
};

const sampleSearchResponse = {
  results: [sampleTMDBMovie, sampleTMDBTV],
};

const sampleDetailResponse = {
  id: 438631,
  title: "Dune",
  release_date: "2021-09-15",
  runtime: 155,
  genres: [
    { id: 878, name: "Science Fiction" },
    { id: 12, name: "Adventure" },
  ],
  vote_average: 7.8,
  popularity: 120.5,
  poster_path: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  backdrop_path: "/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TMDBAdapter", () => {
  let adapter: TMDBAdapter;
  let client: MCPClient;

  beforeEach(() => {
    client = makeMCPClient();
    adapter = new TMDBAdapter({ mcpClient: client });
  });

  // ---------- searchTitles ----------

  describe("searchTitles", () => {
    it("searches movies by default", async () => {
      const results = await adapter.searchTitles("Dune");

      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "search_movies",
        arguments: { query: "Dune" },
      });
      expect(results).toHaveLength(2);
      expect(results[0]!.name).toBe("Dune");
    });

    it("searches TV when type is tv", async () => {
      await adapter.searchTitles("Breaking Bad", { type: "tv" });

      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "search_tv",
        arguments: { query: "Breaking Bad" },
      });
    });

    it("passes year and region options", async () => {
      await adapter.searchTitles("Dune", { year: 2021, region: "US" });

      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "search_movies",
        arguments: { query: "Dune", year: 2021, region: "US" },
      });
    });

    it("returns empty array on failure", async () => {
      const failClient = makeMCPClient({ success: false, error: "API error" });
      const failAdapter = new TMDBAdapter({ mcpClient: failClient });

      const results = await failAdapter.searchTitles("Dune");
      expect(results).toEqual([]);
    });

    it("returns empty array on exception", async () => {
      const throwClient = {
        ...makeMCPClient(),
        callTool: vi.fn(async () => { throw new Error("network failure"); }),
      } as unknown as MCPClient;
      const throwAdapter = new TMDBAdapter({ mcpClient: throwClient });

      const results = await throwAdapter.searchTitles("Dune");
      expect(results).toEqual([]);
    });
  });

  // ---------- multiSearch ----------

  describe("multiSearch", () => {
    it("calls multi_search tool", async () => {
      await adapter.multiSearch("Dune");
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "multi_search",
        arguments: { query: "Dune" },
      });
    });
  });

  // ---------- getTitleDetails ----------

  describe("getTitleDetails", () => {
    it("gets movie details", async () => {
      const detailClient = makeMCPClient({ success: true, data: sampleDetailResponse });
      const detailAdapter = new TMDBAdapter({ mcpClient: detailClient });

      const result = await detailAdapter.getTitleDetails(438631, "movie");

      expect(detailClient.callTool).toHaveBeenCalledWith("tmdb", {
        name: "get_movie_details",
        arguments: { id: 438631 },
      });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Dune");
      expect(result!.genres).toEqual(["Science Fiction", "Adventure"]);
    });

    it("gets TV details", async () => {
      await adapter.getTitleDetails(1399, "tv");
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "get_tv_details",
        arguments: { id: 1399 },
      });
    });

    it("returns null on failure", async () => {
      const failClient = makeMCPClient({ success: false, error: "not found" });
      const failAdapter = new TMDBAdapter({ mcpClient: failClient });

      const result = await failAdapter.getTitleDetails(99999, "movie");
      expect(result).toBeNull();
    });
  });

  // ---------- getTrending ----------

  describe("getTrending", () => {
    it("calls get_trending with defaults", async () => {
      await adapter.getTrending();
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "get_trending",
        arguments: { time_window: "week", media_type: "all" },
      });
    });

    it("passes custom time window and media type", async () => {
      await adapter.getTrending("day", "movie");
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "get_trending",
        arguments: { time_window: "day", media_type: "movie" },
      });
    });
  });

  // ---------- getRecommendations ----------

  describe("getRecommendations", () => {
    it("gets movie recommendations", async () => {
      await adapter.getRecommendations(438631, "movie");
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "get_movie_recommendations",
        arguments: { id: 438631 },
      });
    });

    it("gets TV recommendations", async () => {
      await adapter.getRecommendations(1399, "tv");
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "get_tv_recommendations",
        arguments: { id: 1399 },
      });
    });
  });

  // ---------- discover ----------

  describe("discover", () => {
    it("calls discover with all options", async () => {
      await adapter.discover({
        type: "movie",
        genres: [878, 12],
        yearMin: 2020,
        yearMax: 2025,
        minVoteAverage: 7,
        sortBy: "popularity.desc",
        region: "US",
      });

      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "discover_movies",
        arguments: {
          with_genres: "878,12",
          "primary_release_date.gte": "2020-01-01",
          "primary_release_date.lte": "2025-12-31",
          "vote_average.gte": 7,
          sort_by: "popularity.desc",
          region: "US",
        },
      });
    });

    it("calls discover_tv for TV type", async () => {
      await adapter.discover({ type: "tv" });
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "discover_tv",
        arguments: {},
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Mapping Functions
// ---------------------------------------------------------------------------

describe("mapTMDBResults", () => {
  it("maps paginated response with results array", () => {
    const titles = mapTMDBResults(sampleSearchResponse);
    expect(titles).toHaveLength(2);
    expect(titles[0]!.name).toBe("Dune");
    expect(titles[0]!.type).toBe("movie");
    expect(titles[0]!.tmdbId).toBe(438631);
    expect(titles[0]!.releaseYear).toBe(2021);
    expect(titles[0]!.runtimeMin).toBe(155);
    expect(titles[0]!.genres).toEqual(["Science Fiction", "Adventure"]);
    expect(titles[0]!.posterUrl).toContain("image.tmdb.org");
  });

  it("maps direct array of items", () => {
    const titles = mapTMDBResults([sampleTMDBMovie]);
    expect(titles).toHaveLength(1);
    expect(titles[0]!.name).toBe("Dune");
  });

  it("infers TV type from media_type field", () => {
    const titles = mapTMDBResults([sampleTMDBTV]);
    expect(titles[0]!.type).toBe("tv");
    expect(titles[0]!.name).toBe("Breaking Bad");
  });

  it("filters out items without id or name", () => {
    const titles = mapTMDBResults([
      { id: 1 }, // no name
      { name: "No ID" }, // no id
      sampleTMDBMovie, // valid
    ]);
    expect(titles).toHaveLength(1);
  });

  it("handles empty results", () => {
    expect(mapTMDBResults({ results: [] })).toEqual([]);
    expect(mapTMDBResults([])).toEqual([]);
  });

  it("uses genre names when genres array is provided", () => {
    const result = mapSingleTMDBResult(sampleDetailResponse, "movie");
    expect(result!.genres).toEqual(["Science Fiction", "Adventure"]);
  });

  it("returns moods as empty array (not provided by TMDB)", () => {
    const result = mapSingleTMDBResult(sampleTMDBMovie, "movie");
    expect(result!.moods).toEqual([]);
  });

  it("handles TV show with episode_run_time", () => {
    const result = mapSingleTMDBResult(sampleTMDBTV, "tv");
    expect(result!.runtimeMin).toBe(47);
  });

  it("returns null for item without id", () => {
    const result = mapSingleTMDBResult({}, "movie");
    expect(result).toBeNull();
  });
});
