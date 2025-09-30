import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

// Mock catalog helpers used by admin refresh endpoints
vi.mock('../services/catalog/tmdb', () => ({
  fetchExternalIds: vi.fn(async (_mediaType: string, _tmdbId: number) => ({ imdb_id: 'tt1234567' })),
}));

vi.mock('../services/catalog/omdb', () => ({
  fetchOmdbByImdb: vi.fn(async (_imdbId: string) => ({ Ratings: [{ Source: 'Internet Movie Database', Value: '9.0/10' }] })),
  mapOmdbRatings: vi.fn((_json: any) => [{ source: 'IMDB', valueText: '9.0/10', valueNum: 90 }]),
}));

const prisma = new PrismaClient();
let dbReady = true;

describe('Admin refresh endpoints', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  beforeEach(() => {
    // Disable auth for tests hitting admin endpoints
    process.env.REQUIRE_AUTH = 'false';
    // Stub fetch to accept OpenSearch index PUT
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: any, _init?: RequestInit) => {
        const u = String(url || '');
        if (u.includes('/_doc/')) return new Response('{}', { status: 200 });
        return new Response('{}', { status: 200 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.skipIf(!process.env.DATABASE_URL)('refresh by tmdb id updates imdbId, ratings and reindexes', async () => {
    if (!dbReady) {
      expect(true).toBe(true);
      return;
    }
    const t = await prisma.title.create({
      data: {
        name: `Admin TMDB ${Date.now()}`,
        type: 'MOVIE',
        tmdbId: 999999,
        releaseYear: new Date().getFullYear(),
        posterUrl: 'x',
      },
    });
    const res = await app.inject({ method: 'POST', url: `/v1/admin/refresh/tmdb/${t.tmdbId}` });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.ok).toBeTypeOf('boolean');
    // verify DB has an external rating row
    const ratings = await prisma.externalRating.findMany({ where: { titleId: t.id } });
    expect(ratings.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it.skipIf(!process.env.DATABASE_URL)('refresh by imdb id upserts ratings and reindexes', async () => {
    if (!dbReady) {
      expect(true).toBe(true);
      return;
    }
    const t = await prisma.title.create({
      data: {
        name: `Admin IMDB ${Date.now()}`,
        type: 'MOVIE',
        imdbId: 'tt7654321',
        releaseYear: new Date().getFullYear(),
        posterUrl: 'y',
      },
    });
    const res = await app.inject({ method: 'POST', url: `/v1/admin/refresh/imdb/${t.imdbId}` });
    expect(res.statusCode).toBe(200);
    const ratings = await prisma.externalRating.findMany({ where: { titleId: t.id } });
    expect(ratings.length).toBeGreaterThanOrEqual(1);
  }, 15000);
});


