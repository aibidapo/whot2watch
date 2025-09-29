/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchOmdbByImdb, mapOmdbRatings } = require('./omdb');

async function main() {
  const prisma = new PrismaClient();
  try {
    const titles = await prisma.title.findMany({ where: { NOT: { imdbId: null } }, take: 25 });
    let upserts = 0;
    for (const t of titles) {
      try {
        const omdb = await fetchOmdbByImdb(t.imdbId);
        const ratings = mapOmdbRatings(omdb);
        for (const r of ratings) {
          await prisma.externalRating.upsert({
            where: { titleId_source: { titleId: t.id, source: r.source } },
            update: { valueText: r.valueText, valueNum: r.valueNum, updatedAt: new Date() },
            create: {
              titleId: t.id,
              source: r.source,
              valueText: r.valueText,
              valueNum: r.valueNum ?? null,
            },
          });
          upserts++;
        }
      } catch (err) {
        console.warn(`[omdb] skip ${t.id}: ${String(err)}`);
      }
    }
    console.log(`[omdb] upserted ${upserts} ratings`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
