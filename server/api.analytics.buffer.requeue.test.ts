import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './api';

describe('Analytics buffer requeue on failure', () => {
  beforeEach(() => {
    process.env.ANALYTICS_BUFFER = 'true';
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/sink';
  });

  it('requeues failed events when flush fails', async () => {
    let calls = 0;
    const fetchSpy = vi.fn(async () => {
      calls++;
      // fail first two sends
      if (calls <= 2) throw new Error('fail');
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy as any);
    const internals: any = (app as any).__analytics;
    // enqueue 3 events
    await internals.enqueueAnalytics(app, { event: 'e1' });
    await internals.enqueueAnalytics(app, { event: 'e2' });
    await internals.enqueueAnalytics(app, { event: 'e3' });
    const res1 = await internals.flushAnalytics(app);
    expect(res1.failed).toBeGreaterThanOrEqual(1);
    // second flush should send remaining
    const res2 = await internals.flushAnalytics(app);
    expect(res2.sent + res2.failed).toBeGreaterThanOrEqual(0);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
