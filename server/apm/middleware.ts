/**
 * API Performance Monitoring (APM)
 * Epic 2: Request-level latency, error, and throughput tracking.
 *
 * Maintains in-memory counters and a sliding window of latencies for
 * percentile calculations. Provides a snapshot endpoint consumed by
 * the admin metrics dashboard.
 *
 * Pattern mirrors server/agents/telemetry.ts for consistency.
 */

// ============================================================================
// Types
// ============================================================================

export interface RequestRecord {
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  timestamp: number;
}

export interface RouteMetrics {
  count: number;
  errors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface ApmSnapshot {
  totalRequests: number;
  totalErrors: number;
  total4xx: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  uptimeMs: number;
  byRoute: Record<string, RouteMetrics>;
  statusDistribution: Record<string, number>;
}

// ============================================================================
// In-Memory Counters
// ============================================================================

let totalRequests = 0;
let totalErrors = 0;
let total4xx = 0;
let totalLatencyMs = 0;
const latencies: number[] = [];
const statusCounts: Record<string, number> = {};
const routeData: Record<
  string,
  { count: number; errors: number; totalLatencyMs: number; latencies: number[] }
> = {};
const startTime = Date.now();

const MAX_LATENCIES = 2000;
const MAX_ROUTE_LATENCIES = 500;

// ============================================================================
// Event Recording
// ============================================================================

export function recordRequest(record: RequestRecord): void {
  totalRequests++;
  totalLatencyMs += record.latencyMs;

  if (record.statusCode >= 500) totalErrors++;
  if (record.statusCode >= 400 && record.statusCode < 500) total4xx++;

  // Latency window
  latencies.push(record.latencyMs);
  if (latencies.length > MAX_LATENCIES) latencies.shift();

  // Status distribution
  const statusKey = String(record.statusCode);
  statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

  // Per-route tracking
  const routeKey = `${record.method} ${record.route}`;
  if (!routeData[routeKey]) {
    routeData[routeKey] = { count: 0, errors: 0, totalLatencyMs: 0, latencies: [] };
  }
  const rd = routeData[routeKey]!;
  rd.count++;
  rd.totalLatencyMs += record.latencyMs;
  if (record.statusCode >= 500) rd.errors++;
  rd.latencies.push(record.latencyMs);
  if (rd.latencies.length > MAX_ROUTE_LATENCIES) rd.latencies.shift();
}

// ============================================================================
// Snapshot / Metrics
// ============================================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

export function getApmSnapshot(): ApmSnapshot {
  const avgLatencyMs = totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0;
  const sorted = [...latencies].sort((a, b) => a - b);

  const byRoute: Record<string, RouteMetrics> = {};
  for (const [key, rd] of Object.entries(routeData)) {
    const rSorted = [...rd.latencies].sort((a, b) => a - b);
    byRoute[key] = {
      count: rd.count,
      errors: rd.errors,
      avgLatencyMs: rd.count > 0 ? Math.round(rd.totalLatencyMs / rd.count) : 0,
      p95LatencyMs: percentile(rSorted, 0.95),
    };
  }

  return {
    totalRequests,
    totalErrors,
    total4xx,
    avgLatencyMs,
    p95LatencyMs: percentile(sorted, 0.95),
    p99LatencyMs: percentile(sorted, 0.99),
    uptimeMs: Date.now() - startTime,
    byRoute,
    statusDistribution: { ...statusCounts },
  };
}

// ============================================================================
// Reset (for testing)
// ============================================================================

export function resetApm(): void {
  totalRequests = 0;
  totalErrors = 0;
  total4xx = 0;
  totalLatencyMs = 0;
  latencies.length = 0;
  for (const key of Object.keys(statusCounts)) delete statusCounts[key];
  for (const key of Object.keys(routeData)) delete routeData[key];
}
