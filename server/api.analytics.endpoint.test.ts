import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import app from './api';

describe('Analytics endpoint beacons', () => {
  const originalEnv = { ...process.env } as any;

  beforeAll(async () => {
    await app.listen({ port: 4003, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('logs analytics_event when not in private mode', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'pick_click', titleId: 't1', provider: 'NETFLIX', deepLinkUsed: true },
    });
    expect(res.statusCode).toBe(204);
    const saw = (spy.mock.calls as any[]).some(([line]) => {
      try {
        const obj = JSON.parse(String(line));
        return obj.msg === 'analytics_event' && obj.meta?.event === 'pick_click';
      } catch {
        return false;
      }
    });
    expect(saw).toBe(true);
    spy.mockRestore();
  });

  it('does not log when private mode is enabled', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await app.inject({
      method: 'POST',
      url: '/analytics',
      headers: { 'x-private-mode': 'true' },
      payload: { event: 'pick_click', titleId: 't1' },
    });
    expect(res.statusCode).toBe(204);
    const saw = (spy.mock.calls as any[]).some(([line]) => {
      try {
        const obj = JSON.parse(String(line));
        return obj.msg === 'analytics_event';
      } catch {
        return false;
      }
    });
    expect(saw).toBe(false);
    spy.mockRestore();
  });

  it('does not log when private=true query param is present', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await app.inject({
      method: 'POST',
      url: '/analytics?private=true',
      payload: { event: 'pick_click', titleId: 't1' },
    });
    expect(res.statusCode).toBe(204);
    const saw = (spy.mock.calls as any[]).some(([line]) => {
      try {
        const obj = JSON.parse(String(line));
        return obj.msg === 'analytics_event';
      } catch {
        return false;
      }
    });
    expect(saw).toBe(false);
    spy.mockRestore();
  });

  it('forwards to webhook when configured', async () => {
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/analytics';
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy as any);
    const res = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'pick_copy_link', titleId: 't2' },
    });
    expect(res.statusCode).toBe(204);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('includes bearer token when ANALYTICS_TOKEN is set', async () => {
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/analytics';
    process.env.ANALYTICS_TOKEN = 'secret123';
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as any)?.authorization).toBe('Bearer secret123');
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy as any);
    const res = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'pick_click' },
    });
    expect(res.statusCode).toBe(204);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('logs warn when webhook forwarding fails', async () => {
    process.env.ANALYTICS_WEBHOOK_URL = 'http://example.com/analytics';
    const fetchSpy = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.stubGlobal('fetch', fetchSpy as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await app.inject({
      method: 'POST',
      url: '/analytics',
      payload: { event: 'pick_click' },
    });
    expect(res.statusCode).toBe(204);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
