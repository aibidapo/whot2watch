import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPRegistry, resetMCPRegistry } from "./registry";
import type { MCPClient } from "./client";

// ---------------------------------------------------------------------------
// Mock MCPClient factory
// ---------------------------------------------------------------------------

function makeMCPClient(overrides?: Partial<MCPClient>): MCPClient {
  return {
    registerServer: vi.fn(),
    getServer: vi.fn(async () => ({
      name: "tmdb",
      config: { name: "tmdb", command: "npx", args: [] },
      status: "ready" as const,
      tools: [
        {
          name: "search_movies",
          description: "Search for movies",
          inputSchema: { type: "object" },
        },
        {
          name: "get_trending",
          description: "Get trending titles",
          inputSchema: { type: "object" },
        },
      ],
    })),
    callTool: vi.fn(async () => ({ success: true, data: { results: [] } })),
    getRegisteredServers: vi.fn(() => ["tmdb", "justwatch"]),
    getActiveServers: vi.fn(() => []),
    isServerReady: vi.fn(() => true),
    shutdownServer: vi.fn(async () => {}),
    shutdownAll: vi.fn(async () => {}),
    invalidateCache: vi.fn(async () => {}),
    ...overrides,
  } as unknown as MCPClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCPRegistry", () => {
  let registry: MCPRegistry;
  let client: MCPClient;

  beforeEach(() => {
    resetMCPRegistry();
    client = makeMCPClient();
    registry = new MCPRegistry({ mcpClient: client });
  });

  // ---------- Registration ----------

  describe("registerServersFromConfig", () => {
    it("registers all servers from config object", () => {
      registry.registerServersFromConfig({
        tmdb: { name: "tmdb", command: "npx", args: ["-y", "@anthropic/mcp-server-tmdb"] },
        justwatch: { name: "justwatch", command: "uvx", args: ["mcp-justwatch"] },
      });

      expect(client.registerServer).toHaveBeenCalledTimes(2);
      expect(client.registerServer).toHaveBeenCalledWith(
        expect.objectContaining({ name: "tmdb" })
      );
    });
  });

  // ---------- Tool Discovery ----------

  describe("discoverTools", () => {
    it("discovers tools from a server", async () => {
      const tools = await registry.discoverTools("tmdb");

      expect(tools).toHaveLength(2);
      expect(tools[0]!.name).toBe("search_movies");
      expect(tools[0]!.serverName).toBe("tmdb");
      expect(tools[1]!.name).toBe("get_trending");
    });

    it("caches discovery and returns cached tools on repeat call", async () => {
      await registry.discoverTools("tmdb");
      await registry.discoverTools("tmdb");

      // getServer should only be called once (cached on second call)
      expect(client.getServer).toHaveBeenCalledTimes(1);
    });

    it("re-discovers when force=true", async () => {
      await registry.discoverTools("tmdb");
      await registry.discoverTools("tmdb", true);

      expect(client.getServer).toHaveBeenCalledTimes(2);
    });

    it("returns empty array when server is not available", async () => {
      const noServerClient = makeMCPClient({
        getServer: vi.fn(async () => undefined),
      });
      const reg = new MCPRegistry({ mcpClient: noServerClient });

      const tools = await reg.discoverTools("missing-server");
      expect(tools).toEqual([]);
    });

    it("returns empty array on error", async () => {
      const failClient = makeMCPClient({
        getServer: vi.fn(async () => { throw new Error("init failed"); }),
      });
      const reg = new MCPRegistry({ mcpClient: failClient });

      const tools = await reg.discoverTools("tmdb");
      expect(tools).toEqual([]);
    });
  });

  describe("discoverAll", () => {
    it("discovers tools from all registered servers", async () => {
      // Second server has different tools
      const multiClient = makeMCPClient({
        getServer: vi.fn(async (name: string) => {
          if (name === "tmdb") {
            return {
              name: "tmdb",
              config: { name: "tmdb", command: "npx", args: [] },
              status: "ready" as const,
              tools: [{ name: "search_movies", description: "Search", inputSchema: {} }],
            };
          }
          return {
            name: "justwatch",
            config: { name: "justwatch", command: "uvx", args: [] },
            status: "ready" as const,
            tools: [{ name: "search_availability", description: "Availability", inputSchema: {} }],
          };
        }),
      });
      const reg = new MCPRegistry({ mcpClient: multiClient });

      const tools = await reg.discoverAll();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain("search_movies");
      expect(tools.map((t) => t.name)).toContain("search_availability");
    });
  });

  // ---------- Tool Lookup ----------

  describe("getTool", () => {
    it("returns a discovered tool by name", async () => {
      await registry.discoverTools("tmdb");

      const tool = await registry.getTool("search_movies");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("search_movies");
      expect(tool!.serverName).toBe("tmdb");
    });

    it("triggers progressive discovery for unknown tools", async () => {
      // Tool not yet discovered, but lazy load should find it
      const tool = await registry.getTool("search_movies");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("search_movies");
    });

    it("returns undefined when tool is not found anywhere", async () => {
      const tool = await registry.getTool("nonexistent_tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("getToolsByServer", () => {
    it("filters tools by server name", async () => {
      await registry.discoverTools("tmdb");

      const tools = registry.getToolsByServer("tmdb");
      expect(tools).toHaveLength(2);
      expect(tools.every((t) => t.serverName === "tmdb")).toBe(true);
    });

    it("returns empty array for unknown server", () => {
      const tools = registry.getToolsByServer("unknown");
      expect(tools).toEqual([]);
    });
  });

  describe("getAllTools", () => {
    it("returns all discovered tools", async () => {
      await registry.discoverTools("tmdb");
      const tools = registry.getAllTools();
      expect(tools).toHaveLength(2);
    });
  });

  // ---------- Tool Execution ----------

  describe("executeTool", () => {
    it("executes a tool via the registry", async () => {
      await registry.discoverTools("tmdb");

      const result = await registry.executeTool("search_movies", { query: "Dune" });
      expect(result.success).toBe(true);
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "search_movies",
        arguments: { query: "Dune" },
      });
    });

    it("returns error for unknown tool", async () => {
      const result = await registry.executeTool("nonexistent", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("executeOnServer", () => {
    it("bypasses registry lookup and calls server directly", async () => {
      const result = await registry.executeOnServer("tmdb", "search_movies", {
        query: "Inception",
      });
      expect(result.success).toBe(true);
      expect(client.callTool).toHaveBeenCalledWith("tmdb", {
        name: "search_movies",
        arguments: { query: "Inception" },
      });
    });
  });

  // ---------- Utility ----------

  describe("hasServer / isServerDiscovered", () => {
    it("reports registered servers", () => {
      expect(registry.hasServer("tmdb")).toBe(true);
      expect(registry.hasServer("unknown")).toBe(false);
    });

    it("reports discovery status", async () => {
      expect(registry.isServerDiscovered("tmdb")).toBe(false);
      await registry.discoverTools("tmdb");
      expect(registry.isServerDiscovered("tmdb")).toBe(true);
    });
  });

  describe("clear", () => {
    it("clears all discovered tools and servers", async () => {
      await registry.discoverTools("tmdb");
      expect(registry.getAllTools()).toHaveLength(2);

      registry.clear();
      expect(registry.getAllTools()).toHaveLength(0);
      expect(registry.isServerDiscovered("tmdb")).toBe(false);
    });
  });
});
