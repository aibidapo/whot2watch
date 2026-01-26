import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  JustWatchAdapter,
  mapJustWatchAvailability,
  mapProviders,
} from "./justwatch.adapter";
import type { MCPClient } from "../client";

// ---------------------------------------------------------------------------
// Mock MCPClient
// ---------------------------------------------------------------------------

function makeMCPClient(
  callToolResult?: { success: boolean; data?: unknown; error?: string }
): MCPClient {
  return {
    callTool: vi.fn(async () => callToolResult || { success: true, data: sampleAvailabilityResponse }),
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

const sampleAvailabilityResponse = {
  id: "title-1",
  title: "Dune",
  offers: [
    {
      title_id: "title-1",
      provider_short_name: "nfx",
      provider_name: "Netflix",
      monetization_type: "flatrate",
      url: "https://netflix.com/watch/dune",
    },
    {
      title_id: "title-1",
      provider_short_name: "atp",
      provider_name: "Apple TV+",
      monetization_type: "rent",
      url: "https://tv.apple.com/rent/dune",
      price: { amount: 3.99, currency: "USD" },
    },
    {
      title_id: "title-1",
      provider_short_name: "amz",
      provider_name: "Amazon",
      monetization_type: "buy",
      url: "https://amazon.com/buy/dune",
    },
    {
      title_id: "title-1",
      provider_short_name: "tbi",
      provider_name: "Tubi",
      monetization_type: "free",
      url: "https://tubi.tv/dune",
    },
  ],
};

const sampleProvidersResponse = [
  { id: 1, clear_name: "Netflix", short_name: "nfx", icon_url: "https://cdn.jw.com/nfx.png" },
  { id: 2, clear_name: "Amazon Prime Video", short_name: "amp" },
  { id: 3, clear_name: "Hulu", short_name: "hlu", icon_url: "https://cdn.jw.com/hlu.png" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JustWatchAdapter", () => {
  let adapter: JustWatchAdapter;
  let client: MCPClient;

  beforeEach(() => {
    client = makeMCPClient();
    adapter = new JustWatchAdapter({ mcpClient: client });
  });

  // ---------- searchAvailability ----------

  describe("searchAvailability", () => {
    it("searches for availability by title and region", async () => {
      const results = await adapter.searchAvailability("Dune", "US");

      expect(client.callTool).toHaveBeenCalledWith("justwatch", {
        name: "search_availability",
        arguments: { title: "Dune", region: "US" },
      });
      expect(results).toHaveLength(4);
      expect(results[0]!.service).toBe("nfx");
      expect(results[0]!.offerType).toBe("flatrate");
      expect(results[0]!.deepLink).toBe("https://netflix.com/watch/dune");
    });

    it("passes providers filter", async () => {
      await adapter.searchAvailability("Dune", "US", ["nfx", "amp"]);

      expect(client.callTool).toHaveBeenCalledWith("justwatch", {
        name: "search_availability",
        arguments: { title: "Dune", region: "US", providers: ["nfx", "amp"] },
      });
    });

    it("returns empty array on failure", async () => {
      const failClient = makeMCPClient({ success: false, error: "timeout" });
      const failAdapter = new JustWatchAdapter({ mcpClient: failClient });

      const results = await failAdapter.searchAvailability("Dune", "US");
      expect(results).toEqual([]);
    });

    it("returns empty array on exception", async () => {
      const throwClient = {
        ...makeMCPClient(),
        callTool: vi.fn(async () => { throw new Error("connection refused"); }),
      } as unknown as MCPClient;
      const throwAdapter = new JustWatchAdapter({ mcpClient: throwClient });

      const results = await throwAdapter.searchAvailability("Dune", "US");
      expect(results).toEqual([]);
    });
  });

  // ---------- getAvailabilityById ----------

  describe("getAvailabilityById", () => {
    it("gets availability by TMDB ID", async () => {
      await adapter.getAvailabilityById({ tmdbId: 438631 }, "US");

      expect(client.callTool).toHaveBeenCalledWith("justwatch", {
        name: "get_availability",
        arguments: { region: "US", tmdb_id: 438631 },
      });
    });

    it("gets availability by IMDB ID", async () => {
      await adapter.getAvailabilityById({ imdbId: "tt1160419" }, "US");

      expect(client.callTool).toHaveBeenCalledWith("justwatch", {
        name: "get_availability",
        arguments: { region: "US", imdb_id: "tt1160419" },
      });
    });

    it("passes both IDs and providers", async () => {
      await adapter.getAvailabilityById(
        { tmdbId: 438631, imdbId: "tt1160419" },
        "GB",
        ["nfx"]
      );

      expect(client.callTool).toHaveBeenCalledWith("justwatch", {
        name: "get_availability",
        arguments: {
          region: "GB",
          tmdb_id: 438631,
          imdb_id: "tt1160419",
          providers: ["nfx"],
        },
      });
    });

    it("returns empty array on failure", async () => {
      const failClient = makeMCPClient({ success: false, error: "not found" });
      const failAdapter = new JustWatchAdapter({ mcpClient: failClient });

      const results = await failAdapter.getAvailabilityById({ tmdbId: 99999 }, "US");
      expect(results).toEqual([]);
    });
  });

  // ---------- getProviders ----------

  describe("getProviders", () => {
    it("gets providers for a region", async () => {
      const provClient = makeMCPClient({ success: true, data: sampleProvidersResponse });
      const provAdapter = new JustWatchAdapter({ mcpClient: provClient });

      const providers = await provAdapter.getProviders("US");

      expect(provClient.callTool).toHaveBeenCalledWith("justwatch", {
        name: "get_providers",
        arguments: { region: "US" },
      });
      expect(providers).toHaveLength(3);
      expect(providers[0]!.name).toBe("Netflix");
      expect(providers[0]!.shortName).toBe("nfx");
      expect(providers[0]!.iconUrl).toBe("https://cdn.jw.com/nfx.png");
    });

    it("returns empty array on failure", async () => {
      const failClient = makeMCPClient({ success: false, error: "API error" });
      const failAdapter = new JustWatchAdapter({ mcpClient: failClient });

      const providers = await failAdapter.getProviders("US");
      expect(providers).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Mapping Functions
// ---------------------------------------------------------------------------

describe("mapJustWatchAvailability", () => {
  it("maps single item with offers", () => {
    const results = mapJustWatchAvailability(sampleAvailabilityResponse, "US");
    expect(results).toHaveLength(4);

    expect(results[0]!.service).toBe("nfx");
    expect(results[0]!.offerType).toBe("flatrate");
    expect(results[0]!.region).toBe("US");
    expect(results[0]!.deepLink).toBe("https://netflix.com/watch/dune");

    expect(results[1]!.service).toBe("atp");
    expect(results[1]!.offerType).toBe("rent");

    expect(results[2]!.service).toBe("amz");
    expect(results[2]!.offerType).toBe("buy");

    expect(results[3]!.service).toBe("tbi");
    expect(results[3]!.offerType).toBe("free");
  });

  it("maps array of items", () => {
    const items = [
      { id: "t1", offers: [{ provider_short_name: "nfx", monetization_type: "flatrate" }] },
      { id: "t2", offers: [{ provider_short_name: "hlu", monetization_type: "subscription" }] },
    ];
    const results = mapJustWatchAvailability(items, "US");
    expect(results).toHaveLength(2);
    expect(results[1]!.offerType).toBe("flatrate"); // "subscription" → "flatrate"
  });

  it("handles item without offers", () => {
    const results = mapJustWatchAvailability({ id: "t1" }, "US");
    expect(results).toEqual([]);
  });

  it("filters out unknown monetization types", () => {
    const item = {
      id: "t1",
      offers: [
        { provider_short_name: "nfx", monetization_type: "flatrate" },
        { provider_short_name: "xyz", monetization_type: "unknown_type" },
      ],
    };
    const results = mapJustWatchAvailability(item, "US");
    expect(results).toHaveLength(1);
  });

  it("maps 'ads' monetization type", () => {
    const item = {
      id: "t1",
      offers: [{ provider_short_name: "tbi", monetization_type: "ads" }],
    };
    const results = mapJustWatchAvailability(item, "GB");
    expect(results).toHaveLength(1);
    expect(results[0]!.offerType).toBe("ads");
    expect(results[0]!.region).toBe("GB");
  });

  it("maps 'purchase' to 'buy'", () => {
    const item = {
      id: "t1",
      offers: [{ provider_short_name: "amz", monetization_type: "purchase" }],
    };
    const results = mapJustWatchAvailability(item, "US");
    expect(results[0]!.offerType).toBe("buy");
  });

  it("uses provider_name when provider_short_name is missing", () => {
    const item = {
      id: "t1",
      offers: [{ provider_name: "Netflix", monetization_type: "flatrate" }],
    };
    const results = mapJustWatchAvailability(item, "US");
    expect(results[0]!.service).toBe("Netflix");
  });
});

describe("mapProviders", () => {
  it("maps provider array", () => {
    const providers = mapProviders(sampleProvidersResponse);
    expect(providers).toHaveLength(3);
    expect(providers[0]!.name).toBe("Netflix");
    expect(providers[0]!.shortName).toBe("nfx");
    expect(providers[0]!.iconUrl).toBe("https://cdn.jw.com/nfx.png");
  });

  it("handles provider without icon_url", () => {
    const providers = mapProviders(sampleProvidersResponse);
    expect(providers[1]!.iconUrl).toBeUndefined();
  });

  it("returns empty array for non-array input", () => {
    expect(mapProviders(null)).toEqual([]);
    expect(mapProviders({})).toEqual([]);
    expect(mapProviders("string")).toEqual([]);
  });

  it("filters out entries without name or short_name", () => {
    const providers = mapProviders([{ id: 1 }, ...sampleProvidersResponse]);
    expect(providers).toHaveLength(3);
  });
});
