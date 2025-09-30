/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchExternalIds } = require('./tmdb');

async function main() {
  const prisma = new PrismaClient();
  try {
    const batchSize = Number(process.env.BACKFILL_BATCH || 100);
    const titles = await prisma.title.findMany({
      where: { imdbId: null },
      select: { id: true, tmdbId: true, type: true, name: true },
      take: batchSize,
    });
    if (!titles.length) {
      console.log('[backfill] no titles missing imdbId');
      return;
    }
    let updated = 0;
    for (const t of titles) {
      try {
        const media = t.type === 'SHOW' ? 'tv' : 'movie';
        const ids = await fetchExternalIds(media, String(t.tmdbId));
        const imdb = ids?.imdb_id || null;
        if (imdb) {
          await prisma.title.update({ where: { id: t.id }, data: { imdbId: imdb } });
          updated++;
          console.log(`[backfill] ${t.name} -> ${imdb}`);
        }
      } catch (err) {
        console.warn(`[backfill] skip ${t.id}: ${String(err)}`);
      }
    }
    console.log(`[backfill] updated ${updated}/${titles.length} titles with imdbId`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
