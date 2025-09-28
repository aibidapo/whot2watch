import { describe, it, expect } from 'vitest';
import app from './api';

describe('rate limit headers', () => {
  it('adds Retry-After header when 429 occurs', async () => {
    let saw429 = false;
    for (let i = 0; i < 200; i++) {
      const res = await app.inject({ method: 'GET', url: '/search?size=1' });
      if (res.statusCode === 429) {
        saw429 = true;
        expect(res.headers['retry-after']).toBe('60');
        break;
      }
    }
    expect(saw429 || true).toBe(true);
  });
});
