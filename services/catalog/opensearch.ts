const DEFAULT_OS_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';

export async function ensureIndex(indexName: string, mapping: object): Promise<void> {
  const existsRes = await fetch(`${DEFAULT_OS_URL}/${encodeURIComponent(indexName)}`, {
    method: 'HEAD',
  });
  if (existsRes.status === 200) return;
  const createRes = await fetch(`${DEFAULT_OS_URL}/${encodeURIComponent(indexName)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mapping),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create index ${indexName}: ${createRes.status} ${text}`);
  }
}

export async function indexDocument(indexName: string, id: string, doc: unknown): Promise<void> {
  const res = await fetch(
    `${DEFAULT_OS_URL}/${encodeURIComponent(indexName)}/_doc/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(doc),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to index doc ${id} into ${indexName}: ${res.status} ${text}`);
  }
}
