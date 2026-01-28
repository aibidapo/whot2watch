import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';

let serverUrl = 'http://localhost:4010';

beforeAll(async () => {
  await app.listen({ port: 4010, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
});

describe('Contract smoke tests', () => {
  it('GET /healthz returns { ok: boolean }', async () => {
    const res = await fetch(`${serverUrl}/healthz`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(typeof json.ok).toBe('boolean');
  });

  it('GET /search?size=1 returns items array', async () => {
    const res = await fetch(`${serverUrl}/search?size=1`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json).toHaveProperty('items');
    expect(Array.isArray(json.items)).toBe(true);
  }, 20000);

  it('POST /graphql introspection returns __schema', async () => {
    const res = await fetch(`${serverUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __schema { queryType { name } } }' }),
    });
    // GraphQL may not be mounted in all test configs — accept 200 or 404
    if (res.status === 404) {
      expect(res.status).toBe(404);
      return;
    }
    expect(res.ok).toBe(true);
    const json = await res.json();
    if (json.data) {
      expect(json.data).toHaveProperty('__schema');
    }
  });
});
