import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from './api';

describe('Analytics buffer without webhook', () => {
  const originalEnv = { ...process.env } as any;

  beforeEach(() => {
    process.env.ANALYTICS_BUFFER = 'true';
    delete (process.env as any).ANALYTICS_WEBHOOK_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('does not attempt fetch when webhook is not configured', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy as any);
    const res = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'pick_click' },
    });
    expect(res.statusCode).toBe(204);
    // No webhook configured ⇒ no fetch
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('flushAnalytics exits early when no webhook configured', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy as any);
    const internals: any = (app as any).__analytics;
    await internals.enqueueAnalytics(app, { event: 'picks_served', items: [] });
    const res = await internals.flushAnalytics(app);
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
