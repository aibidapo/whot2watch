import { describe, it, expect } from 'vitest';
import app from './api';

describe('test-ui HTML route', () => {
  it('serves test UI at root', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type'] || '').toContain('text/html');
    expect(res.body.length).toBeGreaterThan(10);
  });
});
