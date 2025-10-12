import { describe, it, expect, vi, afterEach } from 'vitest';

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

// Hoisted Prisma mock so Vitest mock factory can see it
const prismaMockImpl = {
  trendingSignal: {
    findMany: vi.fn(async () => [
      { titleId: 'a', source: 'TMDB_DAY', value: 0.9 },
      { titleId: 'b', source: 'TMDB_WEEK', value: 0.8 },
      { titleId: 'b', source: 'TRAKT_WEEK', value: 0.6 },
    ]),
  },
  title: {
    findMany: vi.fn(async () => [
      {
        id: 'a',
        name: 'Alpha',
        type: 'MOVIE',
        releaseYear: 2024,
        posterUrl: 'p',
        backdropUrl: null,
        voteAverage: 8.1,
        availability: [],
        externalRatings: [],
      },
      {
        id: 'b',
        name: 'Beta',
        type: 'MOVIE',
        releaseYear: 2023,
        posterUrl: 'q',
        backdropUrl: null,
        voteAverage: 7.9,
        availability: [],
        externalRatings: [],
      },
    ]),
  },
} as any;

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => prismaMockImpl),
}));

describe('GET /v1/trending', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns aggregated trending items ordered by composite score', async () => {
    const apiMod: any = await import('./api');
    const app = apiMod.default as any;
    app.redis = stubRedis;

    const res = await app.inject({ method: 'GET', url: '/v1/trending' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
    const names = (json.items || []).map((i: any) => i.name);
    expect(names[0]).toBe('Alpha');
    expect(names[1]).toBe('Beta');
  });
});


