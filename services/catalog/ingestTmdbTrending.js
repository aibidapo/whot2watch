/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchTrendingWindow, fetchExternalIds } = require('./tmdb');

async function upsertTitle(prisma, item) {
  const tmdbIdBig = BigInt(item.tmdbId);
  let imdbId = null;
  try {
    const ids = await fetchExternalIds(item.type === 'SHOW' ? 'tv' : 'movie', item.tmdbId);
    imdbId = ids?.imdb_id || null;
  } catch {}
  const data = {
    tmdbId: tmdbIdBig,
    type: item.type,
    name: item.name,
    releaseYear: item.releaseYear || null,
    posterUrl: item.posterUrl || null,
    backdropUrl: item.backdropUrl || null,
    voteAverage: typeof item.voteAverage === 'number' ? item.voteAverage : null,
    popularity: typeof item.popularity === 'number' ? item.popularity : null,
    imdbId: imdbId || null,
  };
  await prisma.title
    .upsert({
      where: { tmdbId: tmdbIdBig },
      create: data,
      update: {
        name: data.name,
        type: data.type,
        releaseYear: data.releaseYear,
        posterUrl: data.posterUrl,
        backdropUrl: data.backdropUrl,
        voteAverage: data.voteAverage,
        popularity: data.popularity,
        ...(imdbId ? { imdbId } : {}),
      },
    })
    .catch(async (err) => {
      if (String(err || '').includes('Unique')) {
        await prisma.title.update({ where: { tmdbId: tmdbIdBig }, data });
      } else {
        throw err;
      }
    });
  const title = await prisma.title.findUnique({ where: { tmdbId: tmdbIdBig } });
  return title?.id;
}

async function main() {
  const prisma = new PrismaClient();
  const pages = Math.max(1, Number(process.env.TRENDING_PAGES || 1));
  const limit = Math.max(1, Number(process.env.TRENDING_LIMIT || 100));
  try {
    const windows = [
      { win: 'day', source: 'TMDB_DAY' },
      { win: 'week', source: 'TMDB_WEEK' },
    ];
    const mediaTypes = [{ media: 'movie' }, { media: 'tv' }];

    let upserts = 0;
    for (const { win, source } of windows) {
      for (const { media } of mediaTypes) {
        const items = await fetchTrendingWindow(media, win, pages);
        const top = items.slice(0, limit);
        const n = top.length;
        for (let i = 0; i < n; i++) {
          const it = top[i];
          try {
            const titleId = await upsertTitle(prisma, it);
            if (!titleId) continue;
            const value = n > 1 ? 1 - i / (n - 1) : 1; // 1.0 for top, ~0 for last
            await prisma.trendingSignal.upsert({
              where: { titleId_source: { titleId, source } },
              update: { value, ts: new Date() },
              create: { titleId, source, value, ts: new Date() },
            });
            upserts++;
          } catch (err) {
            console.warn(`[trending] skip ${it.tmdbId} ${it.name}: ${String(err)}`);
          }
        }
      }
    }
    console.log(`[trending] upserted ${upserts} trending signals`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});













