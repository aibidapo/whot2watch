import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './api';

describe('Analytics buffer with Redis path', () => {
  beforeEach(() => {
    process.env.ANALYTICS_BUFFER = 'true';
    (app as any).redis = {
      rPush: vi.fn(async () => 1),
      lPush: vi.fn(async () => 1),
      lPop: vi.fn(async () => null),
    };
  });

  it('enqueueAnalytics uses Redis rPush and requeueFront uses lPush', async () => {
    const internals: any = (app as any).__analytics;
    await internals.enqueueAnalytics(app, { event: 'pick_click' });
    expect((app as any).redis.rPush).toHaveBeenCalledWith(
      'analytics:queue',
      expect.stringContaining('pick_click'),
    );
    await internals.requeueFront(app, [{ event: 'picks_served' }]);
    expect((app as any).redis.lPush).toHaveBeenCalled();
  });

  it('dequeueBatch uses Redis lPop', async () => {
    const internals: any = (app as any).__analytics;
    await internals.dequeueBatch(app, 1);
    expect((app as any).redis.lPop).toHaveBeenCalledWith('analytics:queue');
  });
});
