import { describe, it, expect, beforeEach } from "vitest";
import {
  recordChatEvent,
  recordChatError,
  getTelemetrySnapshot,
  resetTelemetry,
  type ChatEvent,
} from "./telemetry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ChatEvent> = {}): ChatEvent {
  return {
    sessionId: "sess-1",
    intent: "search",
    latencyMs: 100,
    recommendationCount: 3,
    fallbackUsed: false,
    workerErrors: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("telemetry", () => {
  beforeEach(() => {
    resetTelemetry();
  });

  describe("getTelemetrySnapshot", () => {
    it("returns zeroed snapshot when no events recorded", () => {
      const snap = getTelemetrySnapshot();
      expect(snap.totalRequests).toBe(0);
      expect(snap.totalErrors).toBe(0);
      expect(snap.totalRecommendations).toBe(0);
      expect(snap.avgLatencyMs).toBe(0);
      expect(snap.p95LatencyMs).toBe(0);
      expect(snap.fallbackRate).toBe(0);
      expect(snap.errorRate).toBe(0);
      expect(snap.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(snap.intentDistribution).toEqual({});
    });
  });

  describe("recordChatEvent", () => {
    it("increments totalRequests", () => {
      recordChatEvent(makeEvent());
      recordChatEvent(makeEvent());
      const snap = getTelemetrySnapshot();
      expect(snap.totalRequests).toBe(2);
    });

    it("accumulates totalRecommendations", () => {
      recordChatEvent(makeEvent({ recommendationCount: 5 }));
      recordChatEvent(makeEvent({ recommendationCount: 3 }));
      const snap = getTelemetrySnapshot();
      expect(snap.totalRecommendations).toBe(8);
    });

    it("calculates average latency", () => {
      recordChatEvent(makeEvent({ latencyMs: 100 }));
      recordChatEvent(makeEvent({ latencyMs: 200 }));
      const snap = getTelemetrySnapshot();
      expect(snap.avgLatencyMs).toBe(150);
    });

    it("tracks intent distribution", () => {
      recordChatEvent(makeEvent({ intent: "search" }));
      recordChatEvent(makeEvent({ intent: "search" }));
      recordChatEvent(makeEvent({ intent: "recommendations" }));
      const snap = getTelemetrySnapshot();
      expect(snap.intentDistribution).toEqual({
        search: 2,
        recommendations: 1,
      });
    });

    it("tracks fallback rate", () => {
      recordChatEvent(makeEvent({ fallbackUsed: true }));
      recordChatEvent(makeEvent({ fallbackUsed: false }));
      const snap = getTelemetrySnapshot();
      expect(snap.fallbackRate).toBe(0.5);
    });

    it("counts worker errors from events", () => {
      recordChatEvent(makeEvent({ workerErrors: 2 }));
      recordChatEvent(makeEvent({ workerErrors: 0 }));
      const snap = getTelemetrySnapshot();
      expect(snap.totalErrors).toBe(2);
    });

    it("calculates p95 latency", () => {
      // 20 events: latencies 1..20
      for (let i = 1; i <= 20; i++) {
        recordChatEvent(makeEvent({ latencyMs: i * 10 }));
      }
      const snap = getTelemetrySnapshot();
      // P95 of [10, 20, 30, ..., 200] = 200 (index 19)
      expect(snap.p95LatencyMs).toBe(200);
    });
  });

  describe("recordChatError", () => {
    it("increments totalErrors and totalRequests", () => {
      recordChatError("sess-1", "INTERNAL_ERROR", 50);
      const snap = getTelemetrySnapshot();
      expect(snap.totalErrors).toBe(1);
      expect(snap.totalRequests).toBe(1);
    });

    it("accumulates latency from errors", () => {
      recordChatError("sess-1", "INTERNAL_ERROR", 50);
      recordChatError("sess-2", "STREAM_ERROR", 150);
      const snap = getTelemetrySnapshot();
      expect(snap.avgLatencyMs).toBe(100);
    });

    it("tracks error rate correctly with mixed events", () => {
      recordChatEvent(makeEvent());
      recordChatEvent(makeEvent());
      recordChatError("sess-err", "TIMEOUT", 500);
      const snap = getTelemetrySnapshot();
      // 1 error out of 3 total requests
      expect(snap.errorRate).toBeCloseTo(1 / 3, 5);
    });
  });

  describe("resetTelemetry", () => {
    it("resets all counters to zero", () => {
      recordChatEvent(makeEvent({ workerErrors: 1, fallbackUsed: true }));
      recordChatError("sess-err", "ERR", 100);

      resetTelemetry();
      const snap = getTelemetrySnapshot();
      expect(snap.totalRequests).toBe(0);
      expect(snap.totalErrors).toBe(0);
      expect(snap.totalRecommendations).toBe(0);
      expect(snap.avgLatencyMs).toBe(0);
      expect(snap.p95LatencyMs).toBe(0);
      expect(snap.intentDistribution).toEqual({});
      expect(snap.fallbackRate).toBe(0);
      expect(snap.errorRate).toBe(0);
    });
  });

  describe("intent distribution snapshot isolation", () => {
    it("returns a copy of intentDistribution, not a reference", () => {
      recordChatEvent(makeEvent({ intent: "search" }));
      const snap1 = getTelemetrySnapshot();
      snap1.intentDistribution["search"] = 999;

      const snap2 = getTelemetrySnapshot();
      expect(snap2.intentDistribution["search"]).toBe(1);
    });
  });
});
