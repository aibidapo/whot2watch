/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX = process.env.TITLES_INDEX || 'titles';

const { titlesMapping: mapping } = require('./mappings');

async function ensureIndex() {
  const head = await fetch(`${OPENSEARCH_URL}/${encodeURIComponent(INDEX)}`, { method: 'HEAD' });
  if (head.status === 200) return;
  const res = await fetch(`${OPENSEARCH_URL}/${encodeURIComponent(INDEX)}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mapping)
  });
  if (!res.ok) throw new Error(`Create index failed: ${res.status} ${await res.text()}`);
}

async function indexDoc(doc) {
  const res = await fetch(`${OPENSEARCH_URL}/${encodeURIComponent(INDEX)}/_doc/${encodeURIComponent(doc.id)}`,
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc) });
  if (!res.ok) throw new Error(`Index doc failed: ${res.status} ${await res.text()}`);
}

function toIndexedDoc(title) {
  return {
    id: title.id,
    name: title.name,
    type: title.type,
    releaseYear: title.releaseYear ?? undefined,
    runtimeMin: title.runtimeMin ?? undefined,
    genres: title.genres || [],
    moods: title.moods || [],
    availabilityServices: Array.from(new Set((title.availability || []).map(a => a.service).filter(Boolean))),
    availabilityRegions: Array.from(new Set((title.availability || []).map(a => a.region).filter(Boolean))),
    availability: (title.availability || []).map(a => ({
      service: a.service,
      region: a.region,
      offerType: a.offerType,
      deepLink: a.deepLink || undefined
    }))
  };
}

async function main() {
  await ensureIndex();
  const prisma = new PrismaClient();
  try {
    const titles = await prisma.title.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { availability: true }
    });
    for (const t of titles) {
      const doc = toIndexedDoc(t);
      await indexDoc(doc);
    }
    console.log(`Indexed ${titles.length} titles from DB into ${INDEX}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
