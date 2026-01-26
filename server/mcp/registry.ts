/**
 * MCP Tool Registry with Progressive Discovery
 * Epic 8: AI & Social — Tool management and lazy discovery
 *
 * Discovers and caches tool definitions from registered MCP servers.
 * Supports progressive (lazy) discovery: tools are discovered on first use.
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { MCPServerConfig, MCPToolCall, MCPToolResult } from "../agents/types";
import { getMCPConfig } from "../agents/config";
import { createLogger } from "../common/logger";
import type { MCPClient } from "./client";

const logger = createLogger("mcp-registry");

// ============================================================================
// Types
// ============================================================================

export interface MCPToolEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

export interface RegistryOptions {
  mcpClient: MCPClient;
}

// ============================================================================
// MCP Registry
// ============================================================================

export class MCPRegistry {
  private mcpClient: MCPClient;
  private config = getMCPConfig();
  private toolMap = new Map<string, MCPToolEntry>();
  private discoveredServers = new Set<string>();

  constructor(options: RegistryOptions) {
    this.mcpClient = options.mcpClient;
  }

  // --------------------------------------------------------------------------
  // Server Registration (loads config from .mcp.json shape)
  // --------------------------------------------------------------------------

  registerServersFromConfig(servers: Record<string, MCPServerConfig>): void {
    for (const [name, config] of Object.entries(servers)) {
      this.mcpClient.registerServer({ ...config, name });
      logger.info(`Registered MCP server: ${name}`);
    }
  }

  // --------------------------------------------------------------------------
  // Tool Discovery
  // --------------------------------------------------------------------------

  /**
   * Discover tools from a specific server. Tools are cached in the registry
   * and subsequent calls are no-ops unless `force` is true.
   */
  async discoverTools(serverName: string, force = false): Promise<MCPToolEntry[]> {
    if (this.discoveredServers.has(serverName) && !force) {
      return this.getToolsByServer(serverName);
    }

    try {
      const server = await this.mcpClient.getServer(serverName);
      if (!server) {
        logger.warn(`Cannot discover tools: server '${serverName}' not available`);
        return [];
      }

      // Retrieve tool list from the server instance
      const tools = server.tools || [];
      const entries: MCPToolEntry[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        serverName,
      }));

      // Cache in registry
      for (const entry of entries) {
        this.toolMap.set(entry.name, entry);
      }

      this.discoveredServers.add(serverName);
      logger.info(`Discovered ${entries.length} tools from server '${serverName}'`);

      return entries;
    } catch (error) {
      logger.error(`Tool discovery failed for server '${serverName}'`, {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Discover tools from all registered servers. Useful at startup when
   * lazy loading is disabled.
   */
  async discoverAll(): Promise<MCPToolEntry[]> {
    const serverNames = this.mcpClient.getRegisteredServers();
    const results: MCPToolEntry[] = [];

    for (const name of serverNames) {
      const tools = await this.discoverTools(name);
      results.push(...tools);
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Tool Lookup
  // --------------------------------------------------------------------------

  /**
   * Get a tool entry by name. If progressive discovery is enabled and the tool
   * is not yet known, this will attempt discovery on all un-discovered servers.
   */
  async getTool(toolName: string): Promise<MCPToolEntry | undefined> {
    // Fast path: already in registry
    const cached = this.toolMap.get(toolName);
    if (cached) return cached;

    // Progressive discovery: try undiscovered servers
    if (this.config.lazyLoadEnabled) {
      const serverNames = this.mcpClient.getRegisteredServers();
      for (const name of serverNames) {
        if (this.discoveredServers.has(name)) continue;

        const tools = await this.discoverTools(name);
        const found = tools.find((t) => t.name === toolName);
        if (found) return found;
      }
    }

    return undefined;
  }

  getToolsByServer(serverName: string): MCPToolEntry[] {
    return Array.from(this.toolMap.values()).filter(
      (t) => t.serverName === serverName
    );
  }

  getAllTools(): MCPToolEntry[] {
    return Array.from(this.toolMap.values());
  }

  hasServer(serverName: string): boolean {
    return this.mcpClient.getRegisteredServers().includes(serverName);
  }

  isServerDiscovered(serverName: string): boolean {
    return this.discoveredServers.has(serverName);
  }

  // --------------------------------------------------------------------------
  // Tool Execution (convenience wrapper)
  // --------------------------------------------------------------------------

  /**
   * Execute a tool by name, resolving which server owns it via the registry.
   * Falls back to direct server-name + tool-call if the tool isn't registered.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const entry = await this.getTool(toolName);
    if (!entry) {
      return { success: false, error: `Tool '${toolName}' not found in registry` };
    }

    const toolCall: MCPToolCall = { name: toolName, arguments: args };
    return this.mcpClient.callTool(entry.serverName, toolCall);
  }

  /**
   * Execute a tool targeting a specific known server, bypassing registry lookup.
   */
  async executeOnServer(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    const toolCall: MCPToolCall = { name: toolName, arguments: args };
    return this.mcpClient.callTool(serverName, toolCall);
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  clear(): void {
    this.toolMap.clear();
    this.discoveredServers.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let registryInstance: MCPRegistry | null = null;

export function getMCPRegistry(options?: RegistryOptions): MCPRegistry {
  if (!registryInstance) {
    if (!options) {
      throw new Error("MCPRegistry requires options on first initialization");
    }
    registryInstance = new MCPRegistry(options);
  }
  return registryInstance;
}

export function resetMCPRegistry(): void {
  if (registryInstance) {
    registryInstance.clear();
    registryInstance = null;
  }
}
