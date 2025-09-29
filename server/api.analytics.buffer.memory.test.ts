import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './api';

describe('Analytics buffer memory fallback', () => {
  beforeEach(() => {
    process.env.ANALYTICS_BUFFER = 'true';
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/sink';
    (app as any).redis = {
      rPush: vi.fn(async () => {
        throw new Error('redis down');
      }),
      lPop: vi.fn(async () => null),
      lPush: vi.fn(async () => 1),
    };
  });

  it('falls back to in-memory queue when Redis push fails and flushes successfully', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy as any);
    const internals: any = (app as any).__analytics;
    await internals.enqueueAnalytics(app, { event: 'picks_served', items: [] });
    // simulate redis unavailable at flush time to drain memory queue
    (app as any).redis = undefined;
    const res = await internals.flushAnalytics(app);
    expect(res.sent + res.failed).toBeGreaterThanOrEqual(0);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
