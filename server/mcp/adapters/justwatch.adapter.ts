/**
 * JustWatch MCP Adapter
 * Epic 1/8: Data Model & AI — Streaming availability via MCP
 *
 * Wraps MCPClient for JustWatch-specific operations. Maps JustWatch tool
 * results to internal AvailabilityResult types. Falls back gracefully.
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { AvailabilityResult, MCPToolResult } from "../../agents/types";
import type { MCPClient } from "../client";
import { createLogger } from "../../common/logger";

const logger = createLogger("justwatch-adapter");

const SERVER_NAME = "justwatch";

export interface JustWatchAdapterDeps {
  mcpClient: MCPClient;
}

// ============================================================================
// JustWatch Adapter
// ============================================================================

export class JustWatchAdapter {
  private mcpClient: MCPClient;

  constructor(deps: JustWatchAdapterDeps) {
    this.mcpClient = deps.mcpClient;
  }

  // --------------------------------------------------------------------------
  // Availability
  // --------------------------------------------------------------------------

  /**
   * Search for streaming availability of a title in a specific region.
   */
  async searchAvailability(
    title: string,
    region: string,
    providers?: string[]
  ): Promise<AvailabilityResult[]> {
    const args: Record<string, unknown> = { title, region };
    if (providers?.length) args.providers = providers;

    const result = await this.callJustWatch("search_availability", args);
    if (!result.success || !result.data) return [];

    return mapJustWatchAvailability(result.data, region);
  }

  /**
   * Get availability for a title by its known IDs (TMDB, IMDB).
   */
  async getAvailabilityById(
    ids: { tmdbId?: number; imdbId?: string },
    region: string,
    providers?: string[]
  ): Promise<AvailabilityResult[]> {
    const args: Record<string, unknown> = { region };
    if (ids.tmdbId) args.tmdb_id = ids.tmdbId;
    if (ids.imdbId) args.imdb_id = ids.imdbId;
    if (providers?.length) args.providers = providers;

    const result = await this.callJustWatch("get_availability", args);
    if (!result.success || !result.data) return [];

    return mapJustWatchAvailability(result.data, region);
  }

  // --------------------------------------------------------------------------
  // Providers
  // --------------------------------------------------------------------------

  /**
   * List available streaming providers for a region.
   */
  async getProviders(region: string): Promise<ProviderInfo[]> {
    const result = await this.callJustWatch("get_providers", { region });
    if (!result.success || !result.data) return [];

    return mapProviders(result.data);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private async callJustWatch(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    try {
      return await this.mcpClient.callTool(SERVER_NAME, {
        name: toolName,
        arguments: args,
      });
    } catch (error) {
      logger.error(`JustWatch tool call failed: ${toolName}`, {
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }
}

// ============================================================================
// JustWatch → AvailabilityResult Mapping
// ============================================================================

interface JustWatchOffer {
  title_id?: string;
  provider_short_name?: string;
  provider_name?: string;
  monetization_type?: string;
  presentation_type?: string;
  url?: string;
  price?: { amount?: number; currency?: string };
}

interface JustWatchItem {
  id?: string;
  title?: string;
  offers?: JustWatchOffer[];
}

export function mapJustWatchAvailability(
  data: unknown,
  region: string
): AvailabilityResult[] {
  const results: AvailabilityResult[] = [];

  // Handle single item or array of items
  const items: JustWatchItem[] = Array.isArray(data)
    ? (data as JustWatchItem[])
    : [data as JustWatchItem];

  for (const item of items) {
    if (!item.offers) continue;

    for (const offer of item.offers) {
      const offerType = mapMonetizationType(offer.monetization_type);
      if (!offerType) continue;

      const entry: AvailabilityResult = {
        titleId: item.id || offer.title_id || "",
        service: offer.provider_short_name || offer.provider_name || "unknown",
        region,
        offerType,
      };
      if (offer.url) entry.deepLink = offer.url;
      results.push(entry);
    }
  }

  return results;
}

function mapMonetizationType(
  type?: string
): AvailabilityResult["offerType"] | null {
  if (!type) return null;

  const normalized = type.toLowerCase();
  switch (normalized) {
    case "flatrate":
    case "subscription":
      return "flatrate";
    case "rent":
      return "rent";
    case "buy":
    case "purchase":
      return "buy";
    case "free":
      return "free";
    case "ads":
      return "ads";
    default:
      return null;
  }
}

// ============================================================================
// Provider Mapping
// ============================================================================

export interface ProviderInfo {
  id: string;
  name: string;
  shortName: string;
  iconUrl?: string;
}

export function mapProviders(data: unknown): ProviderInfo[] {
  if (!Array.isArray(data)) return [];

  return (data as Array<Record<string, unknown>>)
    .filter((p) => p.short_name || p.clear_name)
    .map((p) => {
      const info: ProviderInfo = {
        id: String(p.id || p.short_name || ""),
        name: String(p.clear_name || p.name || p.short_name || ""),
        shortName: String(p.short_name || ""),
      };
      if (p.icon_url) info.iconUrl = String(p.icon_url);
      return info;
    });
}
