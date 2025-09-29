import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from './api';

describe('API /search error path', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 500 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty result when OpenSearch returns 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?q=x&size=1' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.total).toBe(0);
    expect(Array.isArray(json.items)).toBe(true);
  });

  it('returns 400 when search params are invalid (bad numbers)', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?yearMin=abc&size=1' });
    expect(res.statusCode).toBe(400);
  });

  it('accepts service as arbitrary string (schema anyOf permits string)', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?service=%5B1%5D' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
  });

  it('returns empty result when OpenSearch is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    );
    const res = await app.inject({ method: 'GET', url: '/search?q=x&size=1' });
    expect(res.statusCode).toBe(200);
  });
});
