/**
 * AI Telemetry
 * Epic 8/12: AI usage tracking, cost monitoring, performance metrics
 *
 * Provides:
 * - Chat request event recording
 * - Intent distribution tracking
 * - Latency and error metrics
 * - LLM cost estimation stubs (for future LLM integration)
 *
 * All counters are kept in-memory with periodic summary logging.
 * For production, these would feed into an APM or analytics pipeline.
 *
 * Reference: docs/adr/0002-mcp-agentic-architecture.md
 */

import type { UserIntent } from "./types";
import { createLogger } from "../common/logger";

const logger = createLogger("telemetry");

// ============================================================================
// Types
// ============================================================================

export interface ChatEvent {
  sessionId: string;
  intent: UserIntent;
  latencyMs: number;
  recommendationCount: number;
  fallbackUsed: boolean;
  workerErrors: number;
  timestamp: number;
}

export interface TelemetrySnapshot {
  totalRequests: number;
  totalErrors: number;
  totalRecommendations: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  intentDistribution: Record<string, number>;
  fallbackRate: number;
  errorRate: number;
  uptimeMs: number;
}

// ============================================================================
// In-Memory Counters
// ============================================================================

let totalRequests = 0;
let totalErrors = 0;
let totalRecommendations = 0;
let totalLatencyMs = 0;
let totalFallbacks = 0;
const latencies: number[] = [];
const intentCounts: Record<string, number> = {};
const startTime = Date.now();

const MAX_LATENCIES = 1000; // Keep last 1000 for P95 calculation

// ============================================================================
// Event Recording
// ============================================================================

/**
 * Record a completed chat request event.
 * Call this after the orchestrator finishes processing.
 */
export function recordChatEvent(event: ChatEvent): void {
  totalRequests++;
  totalRecommendations += event.recommendationCount;
  totalLatencyMs += event.latencyMs;

  if (event.fallbackUsed) totalFallbacks++;
  if (event.workerErrors > 0) totalErrors += event.workerErrors;

  // Track latencies for P95
  latencies.push(event.latencyMs);
  if (latencies.length > MAX_LATENCIES) {
    latencies.shift();
  }

  // Track intent distribution
  const intentKey = event.intent;
  intentCounts[intentKey] = (intentCounts[intentKey] || 0) + 1;

  logger.info("Chat event recorded", {
    sessionId: event.sessionId,
    intent: event.intent,
    latencyMs: event.latencyMs,
    recommendationCount: event.recommendationCount,
    fallbackUsed: event.fallbackUsed,
  });
}

/**
 * Record a chat request error.
 */
export function recordChatError(
  sessionId: string,
  errorCode: string,
  latencyMs: number
): void {
  totalErrors++;
  totalRequests++;
  totalLatencyMs += latencyMs;

  latencies.push(latencyMs);
  if (latencies.length > MAX_LATENCIES) {
    latencies.shift();
  }

  logger.warn("Chat error recorded", {
    sessionId,
    errorCode,
    latencyMs,
  });
}

// ============================================================================
// Snapshot / Metrics
// ============================================================================

/**
 * Get a snapshot of current telemetry counters.
 * Useful for health dashboards or /v1/chat/metrics endpoint.
 */
export function getTelemetrySnapshot(): TelemetrySnapshot {
  const avgLatencyMs =
    totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0;

  return {
    totalRequests,
    totalErrors,
    totalRecommendations,
    avgLatencyMs,
    p95LatencyMs: calculateP95(),
    intentDistribution: { ...intentCounts },
    fallbackRate: totalRequests > 0 ? totalFallbacks / totalRequests : 0,
    errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
    uptimeMs: Date.now() - startTime,
  };
}

function calculateP95(): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

// ============================================================================
// Reset (for testing)
// ============================================================================

export function resetTelemetry(): void {
  totalRequests = 0;
  totalErrors = 0;
  totalRecommendations = 0;
  totalLatencyMs = 0;
  totalFallbacks = 0;
  latencies.length = 0;
  for (const key of Object.keys(intentCounts)) {
    delete intentCounts[key];
  }
}
