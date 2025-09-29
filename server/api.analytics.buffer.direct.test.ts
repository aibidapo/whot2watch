import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './api';

describe('Analytics buffer direct send path', () => {
  beforeEach(() => {
    process.env.ANALYTICS_BUFFER = 'false';
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/sink';
  });

  it('sendAnalyticsDirect posts when webhook configured', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy as any);
    const internals: any = (app as any).__analytics;
    await internals.sendAnalyticsDirect({ event: 'pick_click' });
    expect(fetchSpy).toHaveBeenCalled();
  });
});
