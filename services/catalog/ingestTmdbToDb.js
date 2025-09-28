/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchTrending } = require('./tmdb');

async function main() {
  const prisma = new PrismaClient();
  try {
    const movies = await fetchTrending('movie', 1);
    const shows = await fetchTrending('tv', 1);
    const items = [...movies, ...shows];
    let created = 0;
    for (const it of items) {
      const exists = await prisma.title
        .findFirst({ where: { tmdbId: BigInt(it.tmdbId) } })
        .catch(() => null);
      if (exists) continue;
      await prisma.title.create({
        data: {
          tmdbId: BigInt(it.tmdbId),
          type: it.type,
          name: it.name,
          releaseYear: it.releaseYear || null,
        },
      });
      created++;
    }
    console.log(
      `TMDB ingest completed. Created ${created} titles (skipped ${items.length - created}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
