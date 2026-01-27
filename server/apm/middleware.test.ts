import { describe, it, expect, beforeEach } from 'vitest';
import { recordRequest, getApmSnapshot, resetApm } from './middleware';

describe('APM middleware', () => {
  beforeEach(() => {
    resetApm();
  });

  it('returns zeroed snapshot when no requests recorded', () => {
    const snap = getApmSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.total4xx).toBe(0);
    expect(snap.avgLatencyMs).toBe(0);
    expect(snap.p95LatencyMs).toBe(0);
    expect(snap.p99LatencyMs).toBe(0);
    expect(snap.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(snap.byRoute)).toHaveLength(0);
    expect(Object.keys(snap.statusDistribution)).toHaveLength(0);
  });

  it('records requests and updates counters', () => {
    recordRequest({
      method: 'GET',
      route: '/search',
      statusCode: 200,
      latencyMs: 50,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/search',
      statusCode: 200,
      latencyMs: 100,
      timestamp: Date.now(),
    });
    const snap = getApmSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.totalErrors).toBe(0);
    expect(snap.avgLatencyMs).toBe(75);
  });

  it('counts 5xx as errors and 4xx separately', () => {
    recordRequest({
      method: 'GET',
      route: '/a',
      statusCode: 500,
      latencyMs: 10,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/b',
      statusCode: 502,
      latencyMs: 20,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/c',
      statusCode: 404,
      latencyMs: 5,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/d',
      statusCode: 429,
      latencyMs: 3,
      timestamp: Date.now(),
    });
    const snap = getApmSnapshot();
    expect(snap.totalErrors).toBe(2);
    expect(snap.total4xx).toBe(2);
  });

  it('calculates P95 latency', () => {
    // Record 20 requests: latencies 1..20
    for (let i = 1; i <= 20; i++) {
      recordRequest({
        method: 'GET',
        route: '/test',
        statusCode: 200,
        latencyMs: i,
        timestamp: Date.now(),
      });
    }
    const snap = getApmSnapshot();
    // 95th percentile of [1..20] → index 19 → value 20
    expect(snap.p95LatencyMs).toBe(20);
  });

  it('tracks per-route breakdown', () => {
    recordRequest({
      method: 'GET',
      route: '/search',
      statusCode: 200,
      latencyMs: 40,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/search',
      statusCode: 500,
      latencyMs: 60,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'POST',
      route: '/feedback',
      statusCode: 201,
      latencyMs: 30,
      timestamp: Date.now(),
    });
    const snap = getApmSnapshot();
    expect(snap.byRoute['GET /search']).toBeDefined();
    expect(snap.byRoute['GET /search']!.count).toBe(2);
    expect(snap.byRoute['GET /search']!.errors).toBe(1);
    expect(snap.byRoute['GET /search']!.avgLatencyMs).toBe(50);
    expect(snap.byRoute['POST /feedback']).toBeDefined();
    expect(snap.byRoute['POST /feedback']!.count).toBe(1);
  });

  it('tracks status distribution', () => {
    recordRequest({
      method: 'GET',
      route: '/a',
      statusCode: 200,
      latencyMs: 10,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/b',
      statusCode: 200,
      latencyMs: 10,
      timestamp: Date.now(),
    });
    recordRequest({
      method: 'GET',
      route: '/c',
      statusCode: 404,
      latencyMs: 10,
      timestamp: Date.now(),
    });
    const snap = getApmSnapshot();
    expect(snap.statusDistribution['200']).toBe(2);
    expect(snap.statusDistribution['404']).toBe(1);
  });

  it('resets all counters', () => {
    recordRequest({
      method: 'GET',
      route: '/x',
      statusCode: 200,
      latencyMs: 100,
      timestamp: Date.now(),
    });
    resetApm();
    const snap = getApmSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(Object.keys(snap.byRoute)).toHaveLength(0);
    expect(Object.keys(snap.statusDistribution)).toHaveLength(0);
  });
});
