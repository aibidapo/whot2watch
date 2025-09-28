import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub redis client before importing the app
const stubClient = {
  on: vi.fn(),
  connect: vi.fn(async () => {}),
  get: vi.fn(async () => null),
  setEx: vi.fn(async () => {}),
};

vi.mock('redis', () => ({
  createClient: () => stubClient,
}));

import app from './api';

const sampleOsResult = {
  took: 5,
  hits: {
    total: { value: 1 },
    hits: [
      { _id: 'doc1', _score: 1.23, _source: { name: 'Doc 1', type: 'MOVIE', releaseYear: 2021 } },
    ],
  },
};

describe('API /search success path and cache', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(sampleOsResult), { status: 200 })),
    );
    (app as any).redis = stubClient;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    stubClient.get.mockClear();
    stubClient.setEx.mockClear();
  });

  it('returns results and caches when q is absent (sort branch)', async () => {
    const res = await app.inject({ method: 'GET', url: '/search?size=1' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items[0].name).toBe('Doc 1');
    expect(stubClient.setEx).toHaveBeenCalled();
    expect(res.headers['cache-control']).toBeTruthy();
  });

  it('returns cached result when present', async () => {
    stubClient.get.mockResolvedValueOnce(
      JSON.stringify({ items: [{ id: '1', name: 'cached' }], total: 1, from: 0, size: 1 }),
    );
    const res = await app.inject({ method: 'GET', url: '/search?size=1' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.items[0].name).toBe('cached');
  });

  it('builds filters from comma-separated params (arr helper branches)', async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      const terms = (body.query?.bool?.filter || []).find(
        (f: any) => f.terms?.availabilityServices,
      );
      expect(terms.terms.availabilityServices).toEqual(['NETFLIX', 'DISNEY_PLUS']);
      return new Response(JSON.stringify(sampleOsResult), { status: 200 });
    });
    vi.stubGlobal('fetch', spy);
    const res = await app.inject({
      method: 'GET',
      url: '/search?service=NETFLIX,DISNEY_PLUS&size=1',
    });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalled();
  });

  it('adds yearMin only range filter', async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      const range = (body.query?.bool?.filter || []).find((f: any) => f.range?.releaseYear);
      expect(range.range.releaseYear.gte).toBe(2005);
      expect(range.range.releaseYear.lte).toBeUndefined();
      return new Response(JSON.stringify(sampleOsResult), { status: 200 });
    });
    vi.stubGlobal('fetch', spy);
    const res = await app.inject({ method: 'GET', url: '/search?yearMin=2005&size=1' });
    expect(res.statusCode).toBe(200);
  });

  it('adds yearMax only range filter', async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      const range = (body.query?.bool?.filter || []).find((f: any) => f.range?.releaseYear);
      expect(range.range.releaseYear.lte).toBe(2010);
      expect(range.range.releaseYear.gte).toBeUndefined();
      return new Response(JSON.stringify(sampleOsResult), { status: 200 });
    });
    vi.stubGlobal('fetch', spy);
    const res = await app.inject({ method: 'GET', url: '/search?yearMax=2010&size=1' });
    expect(res.statusCode).toBe(200);
  });

  it('adds runtimeMax only range filter', async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      const range = (body.query?.bool?.filter || []).find((f: any) => f.range?.runtimeMin);
      expect(range.range.runtimeMin.lte).toBe(120);
      expect(range.range.runtimeMin.gte).toBeUndefined();
      return new Response(JSON.stringify(sampleOsResult), { status: 200 });
    });
    vi.stubGlobal('fetch', spy);
    const res = await app.inject({ method: 'GET', url: '/search?runtimeMax=120&size=1' });
    expect(res.statusCode).toBe(200);
  });

  it('builds type and region filters', async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      const filters = body.query?.bool?.filter || [];
      const types = filters.find((f: any) => f.terms?.type);
      const regions = filters.find((f: any) => f.terms?.availabilityRegions);
      expect(types.terms.type).toEqual(['MOVIE']);
      expect(regions.terms.availabilityRegions).toEqual(['US']);
      return new Response(JSON.stringify(sampleOsResult), { status: 200 });
    });
    vi.stubGlobal('fetch', spy);
    const res = await app.inject({ method: 'GET', url: '/search?type=MOVIE&region=US&size=1' });
    expect(res.statusCode).toBe(200);
  });

  it('returns results and caches when q is present (no sort branch)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search?q=doc&size=1&service=NETFLIX&service=DISNEY_PLUS',
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.total).toBe(1);
    expect(stubClient.setEx).toHaveBeenCalled();
  });

  it('handles numeric range filters and clamps size/from', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search?yearMin=2000&yearMax=2020&runtimeMin=60&runtimeMax=180&size=150&from=-5',
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.size).toBe(100);
    expect(json.from).toBe(0);
  });
});
