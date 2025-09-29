import { describe, it, expect } from 'vitest';
import app from './api';

describe('GET /profiles', () => {
  it('returns list of profiles', async () => {
    const res = await app.inject({ method: 'GET', url: '/profiles' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
  });
});
