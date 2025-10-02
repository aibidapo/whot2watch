import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub redis client before importing the app
const stubRedis: any = {
  on: vi.fn(),
  connect: vi.fn(async () => {}),
  get: vi.fn(async () => null),
  setEx: vi.fn(async () => {}),
};

vi.mock('redis', () => ({
  createClient: () => stubRedis,
}));

// Hoisted prisma mock implementation for Vitest static mock factory
const profileId = '11111111-1111-1111-1111-111111111111';
const now = new Date().toISOString();
const prismaMockImpl = {
  subscription: { findMany: vi.fn(async () => []) },
  profile: { findUnique: vi.fn(async () => ({ id: profileId, locale: 'en-US' })) },
  title: {
    findMany: vi.fn(async () => [
      {
        id: 't1',
        name: 'Alpha',
        type: 'MOVIE',
        releaseYear: 2024,
        popularity: 10,
        createdAt: now,
        tmdbId: 1001n,
        posterUrl: 'x',
        backdropUrl: null,
        availability: [],
      },
      {
        id: 't2',
        name: 'Beta',
        type: 'MOVIE',
        releaseYear: 2024,
        popularity: 10,
        createdAt: now,
        tmdbId: 1002n,
        posterUrl: 'y',
        backdropUrl: null,
        availability: [],
      },
    ]),
  },
  externalRating: { findMany: vi.fn(async () => []) },
  trendingSignal: {
    findMany: vi.fn(async () => [
      { titleId: 't1', source: 'TMDB_DAY', value: 0.9 },
      { titleId: 't2', source: 'TRAKT_WEEK', value: 0.7 },
    ]),
  },
} as any;

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => prismaMockImpl),
}));

describe('picks trending integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boosts titles with TMDB day and Trakt week signals and sets reason', async () => {
    const apiMod: any = await import('./api');
    const app = apiMod.default as any;
    app.redis = stubRedis;

    const res = await app.inject({ method: 'GET', url: `/v1/picks/${profileId}?ratingsBias=0` });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
    // Trending reason flags
    const reasons = (json.items || []).map((i: any) => String(i.reason || ''));
    expect(
      reasons.some((r: string) => r.includes('trending today') || r.includes('trending')),
    ).toBe(true);
    // Alpha has stronger day trending and should rank above Beta
    const names = (json.items || []).map((i: any) => i.name);
    const alphaIdx = names.indexOf('Alpha');
    const betaIdx = names.indexOf('Beta');
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeLessThan(betaIdx);
  });
});
