import { describe, it, expect } from 'vitest';
import app from './api';

describe('GET /profiles', () => {
  it.skipIf(!process.env.DATABASE_URL)('returns list of profiles', async () => {
    const res = await app.inject({ method: 'GET', url: '/profiles' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
  });
});
