/* eslint-disable no-console */
const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const INDEX = process.env.TITLES_INDEX || 'titles';

const { titlesMapping: mapping } = require('./mappings');

const { canonicalizeProvider } = require('./providerAlias');

function normalizeTitle(raw, region) {
  const services = (raw.providers || []).map(canonicalizeProvider).filter(Boolean);
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    releaseYear: raw.releaseYear,
    runtimeMin: raw.runtimeMin,
    genres: raw.genres || [],
    moods: raw.moods || [],
    availabilityServices: services,
    availabilityRegions: [region],
    availability: services.map((s) => ({ service: s, region, offerType: 'SUBSCRIPTION' })),
  };
}

async function ensureIndex() {
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

async function main() {
  await ensureIndex();
  const region = process.env.DEFAULT_REGION || 'US';
  const raw = [
    {
      id: 'seed-1',
      name: 'Seed Example',
      type: 'MOVIE',
      releaseYear: 2024,
      runtimeMin: 95,
      genres: ['COMEDY'],
      providers: ['netflix'],
    },
    {
      id: 'seed-2',
      name: 'Bear Watch',
      type: 'SHOW',
      releaseYear: 2023,
      runtimeMin: 30,
      genres: ['DRAMA'],
      providers: ['hulu'],
    },
  ];
  for (const r of raw) {
    const doc = normalizeTitle(r, region);
    await indexDoc(doc);
  }
  console.log(`Indexed ${raw.length} documents into ${INDEX}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
