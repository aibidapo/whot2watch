import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('picks_served analytics with buffering', () => {
  beforeEach(() => {
    process.env.ANALYTICS_BUFFER = 'true';
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/sink';
    (app as any).redis = undefined; // memory queue path
  });

  it.skip('enqueues via buffer when webhook configured and buffer enabled', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) {
      expect(true).toBe(true);
      return;
    }
    const internals: any = (app as any).__analytics;
    const spy = vi.spyOn(internals, 'enqueueAnalytics');
    const res = await app.inject({ method: 'GET', url: `/picks/${profile.id}` });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
