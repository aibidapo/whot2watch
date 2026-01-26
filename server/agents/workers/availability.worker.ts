/**
 * Availability Worker Agent
 * Epic 8: AI & Social — Streaming availability checks
 *
 * Checks where a title is available for streaming.
 * Uses local Prisma DB or MCP servers depending on AVAILABILITY_SOURCE.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  WorkerInput,
  WorkerResult,
  AvailabilityResult,
  RedisLike,
} from "../types";
import {
  getAvailabilitySource,
  shouldUseMCPForAvailability,
} from "../config";
import type { MCPClient } from "../../mcp/client";
import { createLogger } from "../../common/logger";

const logger = createLogger("availability-worker");

export interface AvailabilityWorkerDeps {
  prisma: PrismaClient;
  redis?: RedisLike;
  mcpClient?: MCPClient;
}

export async function executeAvailability(
  input: WorkerInput,
  deps: AvailabilityWorkerDeps
): Promise<WorkerResult> {
  const start = Date.now();

  try {
    const { intent, context } = input;
    const entities = intent.entities;

    // Determine which titles to check
    const titleNames = entities.titles || [];
    const region = entities.region || context.region || "US";
    const services = entities.services || context.subscriptions || [];

    if (titleNames.length === 0) {
      return {
        worker: "availability",
        success: true,
        data: { items: [], message: "No titles specified for availability check" },
        latencyMs: Date.now() - start,
      };
    }

    let results: AvailabilityResult[];

    if (shouldUseMCPForAvailability() && deps.mcpClient) {
      results = await checkAvailabilityMCP(
        titleNames,
        region,
        services,
        deps.mcpClient
      );
    } else {
      results = await checkAvailabilityLocal(
        titleNames,
        region,
        services,
        deps.prisma
      );
    }

    return {
      worker: "availability",
      success: true,
      data: {
        items: results,
        region,
        source: getAvailabilitySource(),
        servicesChecked: services,
      },
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Availability worker failed", { error: msg });
    return {
      worker: "availability",
      success: false,
      error: msg,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Local DB Availability Check (Prisma)
// ============================================================================

async function checkAvailabilityLocal(
  titleNames: string[],
  region: string,
  services: string[],
  prisma: PrismaClient
): Promise<AvailabilityResult[]> {
  const results: AvailabilityResult[] = [];

  for (const name of titleNames) {
    try {
      // Find the title by name
      const title = await prisma.title.findFirst({
        where: { name: { contains: name, mode: "insensitive" as never } },
        include: {
          availability: {
            where: {
              region,
              ...(services.length > 0 ? { service: { in: services } } : {}),
            },
          },
        },
      });

      if (title) {
        for (const avail of title.availability) {
          const item: AvailabilityResult = {
            titleId: title.id,
            service: avail.service,
            region: avail.region,
            offerType: avail.offerType as AvailabilityResult["offerType"],
          };
          if (avail.deepLink) item.deepLink = avail.deepLink;
          results.push(item);
        }
      }
    } catch (error) {
      logger.warn("Failed to check local availability for title", {
        title: name,
        error: String(error),
      });
    }
  }

  return results;
}

// ============================================================================
// MCP Availability Check (JustWatch/Watchmode)
// ============================================================================

async function checkAvailabilityMCP(
  titleNames: string[],
  region: string,
  services: string[],
  mcpClient: MCPClient
): Promise<AvailabilityResult[]> {
  const results: AvailabilityResult[] = [];

  for (const name of titleNames) {
    try {
      const toolResult = await mcpClient.callTool("justwatch", {
        name: "search_availability",
        arguments: {
          title: name,
          region,
          providers: services.length > 0 ? services : undefined,
        },
      });

      if (toolResult.success && toolResult.data) {
        const data = toolResult.data as AvailabilityResult[];
        results.push(...data);
      } else {
        // MCP failed, fall back to local for this title
        logger.warn("MCP availability check failed, skipping", {
          title: name,
          error: toolResult.error,
        });
      }
    } catch (error) {
      logger.warn("MCP availability error", {
        title: name,
        error: String(error),
      });
    }
  }

  return results;
}

// ============================================================================
// Utilities
// ============================================================================

export function formatAvailabilityResponse(
  results: AvailabilityResult[],
  titleName: string
): string {
  if (results.length === 0) {
    return `I couldn't find streaming availability for "${titleName}" in your region.`;
  }

  const byType = new Map<string, AvailabilityResult[]>();
  for (const r of results) {
    const list = byType.get(r.offerType) || [];
    list.push(r);
    byType.set(r.offerType, list);
  }

  const parts: string[] = [];

  const flatrate = byType.get("flatrate");
  if (flatrate?.length) {
    const svcs = [...new Set(flatrate.map((r) => r.service))];
    parts.push(`streaming on ${svcs.join(", ")}`);
  }

  const rent = byType.get("rent");
  if (rent?.length) {
    const svcs = [...new Set(rent.map((r) => r.service))];
    parts.push(`available to rent on ${svcs.join(", ")}`);
  }

  const buy = byType.get("buy");
  if (buy?.length) {
    const svcs = [...new Set(buy.map((r) => r.service))];
    parts.push(`available to buy on ${svcs.join(", ")}`);
  }

  const free = byType.get("free") || byType.get("ads");
  if (free?.length) {
    const svcs = [...new Set(free.map((r) => r.service))];
    parts.push(`free with ads on ${svcs.join(", ")}`);
  }

  return `"${titleName}" is ${parts.join("; ")}.`;
}
