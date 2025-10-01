/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchExternalIds } = require('./tmdb');

async function main() {
  const prisma = new PrismaClient();
  try {
    const batchSize = Number(process.env.BACKFILL_BATCH || 100);
    // Filter to titles with plausible TMDB ids; skip null/zero/negative
    const titles = await prisma.title.findMany({
      where: { imdbId: null, NOT: [{ tmdbId: null }] },
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
        // Skip obviously invalid ids
        if (t.tmdbId === null || t.tmdbId === undefined) {
          console.warn(`[backfill] skip ${t.id}: no tmdbId`);
          continue;
        }
        const ids = await fetchExternalIds(media, String(t.tmdbId));
        const imdb = ids?.imdb_id || null;
        if (imdb) {
          await prisma.title.update({ where: { id: t.id }, data: { imdbId: imdb } });
          updated++;
          console.log(`[backfill] ${t.name} -> ${imdb}`);
        }
      } catch (err) {
        // When TMDB returns 404 invalid id, drop the tmdbId to prevent repeated failures
        const s = String(err || '');
        if (s.includes('404') || /invalid id/i.test(s)) {
          try {
            await prisma.title.update({ where: { id: t.id }, data: { tmdbId: null } });
            console.warn(`[backfill] cleared invalid tmdbId for ${t.id}`);
          } catch {}
        } else {
          console.warn(`[backfill] skip ${t.id}: ${s}`);
        }
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
