/* eslint-disable no-console */
const DASH_URL = process.env.DASHBOARDS_URL || 'http://localhost:5601';
const INDEX = process.env.TITLES_INDEX || 'titles';
const PATTERN_ID = process.env.OS_INDEX_PATTERN_ID || 'titles-pattern';

async function createIndexPattern() {
  const body = {
    attributes: {
      title: INDEX,
      timeFieldName: undefined
    }
  };
  const res = await fetch(`${DASH_URL}/api/saved_objects/index-pattern/${encodeURIComponent(PATTERN_ID)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'osd-xsrf': 'true', 'kbn-xsrf': 'true' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create index pattern: ${res.status} ${text}`);
  }
}

async function main() {
  await createIndexPattern();
  console.log(`Index pattern '${INDEX}' created as id '${PATTERN_ID}'.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
