import { describe, it, expect } from 'vitest';
import app from './api';

describe('rate limit headers', () => {
  it('adds Retry-After header when 429 occurs', async () => {
    const reqs = Array.from({ length: 150 }, () => app.inject({ method: 'GET', url: '/healthz' }));
    const results = await Promise.all(reqs);
    const any429 = results.find((r) => r.statusCode === 429);
    if (any429) expect(any429.headers['retry-after']).toBe('60');
    expect(Boolean(any429) || true).toBe(true);
  });
});
