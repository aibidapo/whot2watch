/**
 * MCP Client Wrapper with Caching and Backoff
 * Epic 0: HTTP caching/backoff utility
 * Epic 8: AI & Social - MCP Infrastructure
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type {
  MCPServerConfig,
  MCPToolCall,
  MCPToolResult,
  RedisLike,
} from "../agents/types";
import { getMCPConfig } from "../agents/config";
import { createLogger } from "../common/logger";

const logger = createLogger("mcp-client");

// ============================================================================
// MCP Client
// ============================================================================

export interface MCPClientOptions {
  redis?: RedisLike;
  cacheKeyPrefix?: string;
}

export class MCPClient {
  private redis?: RedisLike;
  private cacheKeyPrefix: string;
  private config = getMCPConfig();
  private servers = new Map<string, MCPServerInstance>();
  private toolRegistry = new Map<string, MCPServerConfig>();

  constructor(options: MCPClientOptions = {}) {
    if (options.redis) this.redis = options.redis;
    this.cacheKeyPrefix = options.cacheKeyPrefix || "mcp:cache:";
  }

  // --------------------------------------------------------------------------
  // Server Management
  // --------------------------------------------------------------------------

  registerServer(config: MCPServerConfig): void {
    this.toolRegistry.set(config.name, config);
    logger.info("MCP server registered", { server: config.name });
  }

  async getServer(name: string): Promise<MCPServerInstance | undefined> {
    // Check if already initialized
    if (this.servers.has(name)) {
      return this.servers.get(name);
    }

    const config = this.toolRegistry.get(name);
    if (!config) {
      logger.warn("MCP server not registered", { server: name });
      return undefined;
    }

    // Lazy load if enabled and server not yet started
    if (this.config.lazyLoadEnabled) {
      const instance = await this.initializeServer(config);
      this.servers.set(name, instance);
      return instance;
    }

    return undefined;
  }

  private async initializeServer(
    config: MCPServerConfig
  ): Promise<MCPServerInstance> {
    logger.info("Initializing MCP server", { server: config.name });

    // In a real implementation, this would spawn the MCP server process
    // using the @modelcontextprotocol/sdk
    // For now, return a mock instance
    return {
      name: config.name,
      config,
      status: "ready",
      tools: [],
    };
  }

  async shutdownServer(name: string): Promise<void> {
    const instance = this.servers.get(name);
    if (instance) {
      logger.info("Shutting down MCP server", { server: name });
      // In real implementation: close process, cleanup resources
      this.servers.delete(name);
    }
  }

  async shutdownAll(): Promise<void> {
    const names = Array.from(this.servers.keys());
    await Promise.all(names.map((name) => this.shutdownServer(name)));
  }

  // --------------------------------------------------------------------------
  // Tool Execution with Caching and Backoff
  // --------------------------------------------------------------------------

  async callTool(
    serverName: string,
    toolCall: MCPToolCall
  ): Promise<MCPToolResult> {
    const cacheKey = this.buildCacheKey(serverName, toolCall);

    // Check cache first
    const cached = await this.getCached(cacheKey);
    if (cached) {
      logger.debug("Cache hit", { server: serverName, tool: toolCall.name });
      return cached;
    }

    // Execute with retry/backoff
    const result = await this.executeWithBackoff(serverName, toolCall);

    // Cache successful results
    if (result.success) {
      await this.setCache(cacheKey, result);
    }

    return result;
  }

  private async executeWithBackoff(
    serverName: string,
    toolCall: MCPToolCall
  ): Promise<MCPToolResult> {
    let lastError: Error | undefined;
    let backoffMs = this.config.backoffMs;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const server = await this.getServer(serverName);
        if (!server) {
          return {
            success: false,
            error: `MCP server '${serverName}' not available`,
          };
        }

        // Execute the tool call
        const result = await this.executeTool(server, toolCall);

        logger.info("MCP tool call completed", {
          server: serverName,
          tool: toolCall.name,
          attempt,
          success: result.success,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn("MCP tool call failed, retrying", {
          server: serverName,
          tool: toolCall.name,
          attempt,
          error: lastError.message,
        });

        if (attempt < this.config.maxRetries) {
          await this.sleep(backoffMs);
          backoffMs *= 2; // Exponential backoff
        }
      }
    }

    logger.error("MCP tool call failed after all retries", {
      server: serverName,
      tool: toolCall.name,
      error: lastError?.message,
    });

    return {
      success: false,
      error: lastError?.message || "Unknown error after retries",
    };
  }

  private async executeTool(
    _server: MCPServerInstance,
    toolCall: MCPToolCall
  ): Promise<MCPToolResult> {
    // In a real implementation, this would use the MCP SDK to execute the tool
    // Example with @modelcontextprotocol/sdk:
    //
    // const response = await server.client.callTool({
    //   name: toolCall.name,
    //   arguments: toolCall.arguments,
    // });
    // return { success: true, data: response.content };

    // For now, return a placeholder indicating MCP is not yet connected
    return {
      success: false,
      error: `MCP tool execution not yet implemented: ${toolCall.name}`,
    };
  }

  // --------------------------------------------------------------------------
  // Caching
  // --------------------------------------------------------------------------

  private buildCacheKey(serverName: string, toolCall: MCPToolCall): string {
    const argsHash = this.hashObject(toolCall.arguments);
    return `${this.cacheKeyPrefix}${serverName}:${toolCall.name}:${argsHash}`;
  }

  private hashObject(obj: Record<string, unknown>): string {
    // Simple hash for cache key - in production use a proper hash function
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private async getCached(key: string): Promise<MCPToolResult | null> {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as MCPToolResult;
      }
    } catch (error) {
      logger.warn("Cache read failed", { key, error: String(error) });
    }

    return null;
  }

  private async setCache(key: string, result: MCPToolResult): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(key, JSON.stringify(result), {
        EX: this.config.cacheSeconds,
      });
    } catch (error) {
      logger.warn("Cache write failed", { key, error: String(error) });
    }
  }

  async invalidateCache(pattern: string): Promise<void> {
    if (!this.redis) return;

    // In production, use SCAN to find and delete matching keys
    logger.info("Cache invalidation requested", { pattern });
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getRegisteredServers(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  getActiveServers(): string[] {
    return Array.from(this.servers.keys());
  }

  isServerReady(name: string): boolean {
    const server = this.servers.get(name);
    return server?.status === "ready";
  }
}

// ============================================================================
// MCP Server Instance
// ============================================================================

interface MCPServerInstance {
  name: string;
  config: MCPServerConfig;
  status: "initializing" | "ready" | "error" | "shutdown";
  tools: MCPToolDefinition[];
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(options?: MCPClientOptions): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient(options);
  }
  return mcpClientInstance;
}

export function resetMCPClient(): void {
  if (mcpClientInstance) {
    mcpClientInstance.shutdownAll().catch((err) => {
      logger.error("Error shutting down MCP client", { error: String(err) });
    });
    mcpClientInstance = null;
  }
}
