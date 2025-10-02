/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchTraktTrending } = require('./trakt');
const { fetchExternalIds } = require('./tmdb');

async function upsertTitle(prisma, item) {
  // Prefer TMDB id to anchor to our Title; fallback to imdbId only if present
  let tmdbIdBig = null;
  try {
    if (typeof item.tmdbId === 'number') tmdbIdBig = BigInt(item.tmdbId);
    else if (item.imdbId) {
      // attempt to resolve TMDB via external_ids if imdb is present
      // This step can be skipped; but we retain for better linkage when possible
    }
  } catch {}

  const data = {
    tmdbId: tmdbIdBig,
    type: item.type,
    name: item.name,
    releaseYear: item.releaseYear || null,
  };

  let titleId;
  if (tmdbIdBig) {
    const res = await prisma.title.upsert({
      where: { tmdbId: tmdbIdBig },
      create: data,
      update: { name: data.name, type: data.type, releaseYear: data.releaseYear },
    });
    titleId = res.id;
  } else if (item.imdbId) {
    const res = await prisma.title.upsert({
      where: { imdbId: item.imdbId },
      create: { ...data, imdbId: item.imdbId },
      update: { name: data.name, type: data.type, releaseYear: data.releaseYear },
    });
    titleId = res.id;
  }
  return titleId;
}

async function main() {
  const prisma = new PrismaClient();
  const pages = Math.max(1, Number(process.env.TRAKT_TRENDING_PAGES || 1));
  const limit = Math.max(1, Number(process.env.TRAKT_TRENDING_LIMIT || 100));
  try {
    const mediaTypes = [{ media: 'movie' }, { media: 'tv' }];
    let upserts = 0;
    for (const { media } of mediaTypes) {
      const items = await fetchTraktTrending(media, pages);
      const top = items.slice(0, limit);
      const n = top.length;
      for (let i = 0; i < n; i++) {
        const it = top[i];
        try {
          const titleId = await upsertTitle(prisma, it);
          if (!titleId) continue;
          const value = n > 1 ? 1 - i / (n - 1) : 1; // normalized top=1
          const source = media === 'tv' ? 'TRAKT_WEEK' : 'TRAKT_WEEK';
          await prisma.trendingSignal.upsert({
            where: { titleId_source: { titleId, source } },
            update: { value, ts: new Date() },
            create: { titleId, source, value, ts: new Date() },
          });
          upserts++;
        } catch (err) {
          console.warn(`[trakt-trending] skip ${it.name || '?'}: ${String(err)}`);
        }
      }
    }
    console.log(`[trakt-trending] upserted ${upserts} trending signals`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
