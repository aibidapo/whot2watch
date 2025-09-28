/* eslint-disable no-console */
// Ingestion worker stub: TMDB → Postgres → OpenSearch
const { PrismaClient } = require('@prisma/client');
const { fetchTrending } = require('./tmdb');
const { canonicalizeProvider } = require('./providerAlias');

async function run() {
  const prisma = new PrismaClient();
  const region = process.env.DEFAULT_REGION || 'US';
  try {
    // 1) Fetch trending movies & shows (1 page each for stub). Fallback to sample when TMDB creds missing or call fails.
    let items = [];
    const pages = Number(process.env.TMDB_PAGES || '3');
    try {
      const movies = await fetchTrending('movie', pages);
      const shows = await fetchTrending('tv', pages);
      items = [...movies, ...shows];
    } catch (_err) {
      items = [
        { tmdbId: 'seed-m-1', name: 'Seed Example', type: 'MOVIE', releaseYear: 2024 },
        { tmdbId: 'seed-s-1', name: 'Bear Watch', type: 'SHOW', releaseYear: 2023 },
      ];
      console.warn('[worker.ingest] TMDB unavailable; using sample titles fallback');
    }

    // 2) Upsert minimal Titles; availability can be augmented later
    for (const t of items) {
      const tmdbIdNum =
        t.tmdbId !== undefined && /^\d+$/.test(String(t.tmdbId)) ? BigInt(t.tmdbId) : undefined;
      const whereExisting =
        tmdbIdNum !== undefined ? { tmdbId: tmdbIdNum } : { name: t.name, type: t.type };
      const existing = await prisma.title.findFirst({ where: whereExisting }).catch(() => null);
      if (existing) {
        await prisma.title.update({
          where: { id: existing.id },
          data: {
            name: t.name,
            type: t.type,
            releaseYear: t.releaseYear,
            posterUrl: t.posterUrl || existing.posterUrl,
            backdropUrl: t.backdropUrl || existing.backdropUrl,
            voteAverage: t.voteAverage ?? existing.voteAverage,
            popularity: t.popularity ?? existing.popularity,
          },
        });
      } else {
        await prisma.title.create({
          data: {
            tmdbId: tmdbIdNum,
            name: t.name,
            type: t.type,
            releaseYear: t.releaseYear,
            posterUrl: t.posterUrl || null,
            backdropUrl: t.backdropUrl || null,
            voteAverage: t.voteAverage ?? null,
            popularity: t.popularity ?? null,
            availability: {
              create: [
                { service: canonicalizeProvider('netflix'), region, offerType: 'SUBSCRIPTION' },
              ],
            },
          },
        });
      }
    }

    console.log(`[worker.ingest] Upserted ${items.length} titles`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
