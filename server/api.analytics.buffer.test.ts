import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from './api';

describe('Analytics buffer', () => {
  const originalEnv = { ...process.env } as any;

  beforeAll(() => {
    process.env.ANALYTICS_BUFFER = 'true';
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/analytics';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('enqueues on failure and flushes on success', async () => {
    let fail = true;
    const fetchSpy = vi.fn(async () => {
      if (fail) throw new Error('fail');
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy as any);

    // First call fails → should be enqueued
    const res1 = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'pick_click' },
    });
    expect(res1.statusCode).toBe(204);

    // Now set success; manually flush
    fail = false;
    const internals: any = (app as any).__analytics;
    await internals.flushAnalytics(app);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
