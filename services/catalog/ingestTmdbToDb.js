/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchTrending, fetchExternalIds } = require('./tmdb');

async function main() {
  const prisma = new PrismaClient();
  try {
    const movies = await fetchTrending('movie', 1);
    const shows = await fetchTrending('tv', 1);
    const items = [...movies, ...shows];
    let created = 0;
    let updated = 0;
    for (const it of items) {
      const tmdbIdBig = BigInt(it.tmdbId);
      let imdbId = null;
      try {
        const ids = await fetchExternalIds(it.type === 'SHOW' ? 'tv' : 'movie', it.tmdbId);
        imdbId = ids?.imdb_id || null;
      } catch {}
      const data = {
        tmdbId: tmdbIdBig,
        type: it.type,
        name: it.name,
        releaseYear: it.releaseYear || null,
        posterUrl: it.posterUrl || null,
        backdropUrl: it.backdropUrl || null,
        voteAverage: typeof it.voteAverage === 'number' ? it.voteAverage : null,
        popularity: typeof it.popularity === 'number' ? it.popularity : null,
        imdbId: imdbId || null,
      };
      await prisma.title
        .upsert({
          where: { tmdbId: tmdbIdBig },
          create: data,
          update: {
            // Refresh imagery and signals on repeated ingests
            name: data.name,
            type: data.type,
            releaseYear: data.releaseYear,
            posterUrl: data.posterUrl,
            backdropUrl: data.backdropUrl,
            voteAverage: data.voteAverage,
            popularity: data.popularity,
            // only set imdbId if discovered this run
            ...(imdbId ? { imdbId } : {}),
          },
        })
        .then((res) => {
          if (res.createdAt && res.updatedAt && String(res.createdAt) === String(res.updatedAt))
            created++;
          else updated++;
        })
        .catch(async (err) => {
          // On unique clashes without upsert (older Prisma), fall back to update
          if (String(err || '').includes('Unique')) {
            await prisma.title.update({ where: { tmdbId: tmdbIdBig }, data });
            updated++;
          } else {
            throw err;
          }
        });
    }
    console.log(
      `TMDB ingest completed. Created ${created}, updated ${updated} (total ${items.length}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
