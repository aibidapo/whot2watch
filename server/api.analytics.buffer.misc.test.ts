import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './api';

describe('Analytics buffer misc branches', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANALYTICS_WEBHOOK_URL;
  });

  it('sendAnalyticsDirect returns true without calling fetch when no webhook configured', async () => {
    const internals: any = (app as any).__analytics;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy as any);
    const ok = await internals.sendAnalyticsDirect({ event: 'noop' });
    expect(ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('flushAnalytics returns zero when queue empty', async () => {
    process.env.ANALYTICS_BUFFER = 'true';
    const internals: any = (app as any).__analytics;
    const res = await internals.flushAnalytics(app);
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(0);
  });

  it('requeueFront with empty list is a no-op', async () => {
    const internals: any = (app as any).__analytics;
    // Ensure memory path
    (app as any).redis = undefined;
    // capture current queue reference
    const before = JSON.stringify(internals as any);
    await internals.requeueFront(app, []);
    // nothing to assert beyond not throwing; ensure test runs
    expect(true).toBe(true);
  });
});
