/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX = process.env.TITLES_INDEX || 'titles';

const mapping = {
  settings: {
    analysis: {
      analyzer: {
        title_edge: { tokenizer: 'edge_ngram', filter: ['lowercase'] }
      },
      tokenizer: {
        edge_ngram: { type: 'edge_ngram', min_gram: 2, max_gram: 15 }
      }
    }
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: { type: 'text', analyzer: 'title_edge', search_analyzer: 'standard' },
      type: { type: 'keyword' },
      releaseYear: { type: 'integer' },
      runtimeMin: { type: 'integer' },
      genres: { type: 'keyword' },
      moods: { type: 'keyword' },
      availabilityServices: { type: 'keyword' },
      availabilityRegions: { type: 'keyword' },
      popularity: { type: 'float' },
      availability: {
        type: 'nested',
        properties: {
          service: { type: 'keyword' },
          region: { type: 'keyword' },
          offerType: { type: 'keyword' }
        }
      }
    }
  }
};

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
      offerType: a.offerType
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
