/* eslint-disable no-console */
// Ingestion worker stub: TMDB → Postgres → OpenSearch
const { PrismaClient } = require('@prisma/client')
const { fetchTrending } = require('./tmdb')
const { canonicalizeProvider } = require('./providerAlias')

async function run() {
  const prisma = new PrismaClient()
  const region = process.env.DEFAULT_REGION || 'US'
  try {
    // 1) Fetch trending movies & shows (1 page each for stub)
    const movies = await fetchTrending('movie', 1)
    const shows = await fetchTrending('tv', 1)
    const items = [...movies, ...shows]

    // 2) Upsert minimal Titles; availability can be augmented later
    for (const t of items) {
      await prisma.title.upsert({
        where: { id: t.tmdbId?.toString() ?? `tmdb-${t.type}-${t.name}` },
        update: {
          name: t.name,
          type: t.type,
          releaseYear: t.releaseYear,
        },
        create: {
          id: t.tmdbId?.toString() ?? `tmdb-${t.type}-${t.name}`,
          name: t.name,
          type: t.type,
          releaseYear: t.releaseYear,
          availability: { create: [{ service: canonicalizeProvider('netflix'), region, offerType: 'SUBSCRIPTION' }] },
        },
      })
    }

    console.log(`[worker.ingest] Upserted ${items.length} titles`)
  } finally {
    await prisma.$disconnect()
  }
}

run().catch((e) => { console.error(e); process.exit(1) })


