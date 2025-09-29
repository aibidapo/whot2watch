import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const stubRedis = {
  on: vi.fn(),
  connect: vi.fn(async () => {}),
  get: vi.fn(async () => null),
  setEx: vi.fn(async () => {}),
};

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

describe('API /search redis error resilience', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(sampleOsResult), { status: 200 })),
    );
    (app as any).redis = stubRedis as any;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    stubRedis.get.mockReset();
    stubRedis.setEx.mockReset();
  });

  it('continues when redis.get throws (cache read path)', async () => {
    stubRedis.get.mockRejectedValueOnce(new Error('get-fail'));
    stubRedis.setEx.mockResolvedValueOnce(undefined as any);
    const res = await app.inject({ method: 'GET', url: '/search?size=1' });
    expect(res.statusCode).toBe(200);
    // ensure we still attempted to write cache despite read failure
    expect(stubRedis.setEx).toHaveBeenCalled();
  });

  it('continues when redis.setEx throws (cache write path)', async () => {
    stubRedis.get.mockResolvedValueOnce(null as any);
    stubRedis.setEx.mockRejectedValueOnce(new Error('set-fail'));
    const res = await app.inject({ method: 'GET', url: '/search?size=1' });
    expect(res.statusCode).toBe(200);
  });
});
