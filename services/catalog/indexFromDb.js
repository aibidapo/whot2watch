/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX = process.env.TITLES_INDEX || 'titles';

const { titlesMapping: mapping } = require('./mappings');

async function waitForOpenSearch(timeoutMs = 60000) {
  const t0 = Date.now();
  // poll the root endpoint until it responds
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`${OPENSEARCH_URL}`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('OpenSearch not ready after wait');
}

async function ensureIndex() {
  await waitForOpenSearch().catch(() => {});
  const head = await fetch(`${OPENSEARCH_URL}/${encodeURIComponent(INDEX)}`, { method: 'HEAD' });
  if (head.status === 200) return;
  const res = await fetch(`${OPENSEARCH_URL}/${encodeURIComponent(INDEX)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`Create index failed: ${res.status} ${await res.text()}`);
}

async function indexDoc(doc) {
  const res = await fetch(
    `${OPENSEARCH_URL}/${encodeURIComponent(INDEX)}/_doc/${encodeURIComponent(doc.id)}`,
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc) },
  );
  if (!res.ok) throw new Error(`Index doc failed: ${res.status} ${await res.text()}`);
}

function toIndexedDoc(title) {
  // Map external ratings to flattened fields (0-100 scale)
  const ratings = Array.isArray(title.externalRatings) ? title.externalRatings : [];
  const ratingsBySrc = Object.fromEntries(
    ratings.map((r) => [String(r.source || '').toUpperCase(), r.valueNum]).filter(Boolean),
  );
  return {
    id: title.id,
    name: title.name,
    type: title.type,
    releaseYear: title.releaseYear ?? undefined,
    runtimeMin: title.runtimeMin ?? undefined,
    genres: title.genres || [],
    moods: title.moods || [],
    posterUrl: title.posterUrl || undefined,
    backdropUrl: title.backdropUrl || undefined,
    voteAverage: title.voteAverage ?? undefined,
    popularity: title.popularity ?? undefined,
    ratingsImdb: ratingsBySrc.IMDB ?? undefined,
    ratingsRottenTomatoes: ratingsBySrc.ROTTEN_TOMATOES ?? undefined,
    ratingsMetacritic: ratingsBySrc.METACRITIC ?? undefined,
    availabilityServices: Array.from(
      new Set((title.availability || []).map((a) => a.service).filter(Boolean)),
    ),
    availabilityRegions: Array.from(
      new Set((title.availability || []).map((a) => a.region).filter(Boolean)),
    ),
    availability: (title.availability || []).map((a) => ({
      service: a.service,
      region: a.region,
      offerType: a.offerType,
      deepLink: a.deepLink || undefined,
    })),
  };
}

async function main() {
  await ensureIndex();
  const prisma = new PrismaClient();
  try {
    const batchSize = Number(process.env.INDEX_BATCH || 500);
    let lastId = '';
    let total = 0;
    for (;;) {
      const where = lastId ? { id: { gt: lastId } } : {};
      const titles = await prisma.title.findMany({
        where,
        take: batchSize,
        orderBy: { id: 'asc' },
        include: { availability: true, externalRatings: true },
      });
      if (!titles.length) break;
      for (const t of titles) {
        const doc = toIndexedDoc(t);
        await indexDoc(doc);
      }
      total += titles.length;
      lastId = titles[titles.length - 1].id;
      console.log(`Indexed ${total} so far...`);
    }
    console.log(`Indexed ${total} titles from DB into ${INDEX}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
