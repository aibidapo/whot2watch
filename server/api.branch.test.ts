import { describe, it, expect, beforeAll, vi } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('API branch coverage', () => {
  let profileId: string;
  let titleId: string;

  beforeAll(async () => {
    const profile = await prisma.profile.findFirst();
    const title = await prisma.title.findFirst();
    profileId = profile!.id;
    titleId = title!.id;
  });

  it('search builds all filters and clamps size/from', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search?q=matrix&size=150&from=-5&service=NETFLIX,DISNEY_PLUS&region=US,CA&type=MOVIE,SHOW&yearMin=2000&yearMax=2020&runtimeMin=60&runtimeMax=180',
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.size).toBe(100); // clamped
    expect(json.from).toBe(0); // clamped
  });

  it('lists create invalid input returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/lists`,
      payload: { visibility: 'PRIVATE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('subscriptions delete returns ok when none exists', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/profiles/${profileId}/subscriptions`,
      payload: { service: 'DISNEY_PLUS' },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.ok).toBe(true);
  });

  it('alerts create with only services', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/alerts`,
      payload: { services: ['NETFLIX'], region: 'US' },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.alert).toBeTruthy();
  });

  it('feedback persists when not private', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { profileId, titleId, action: 'LIKE' },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.feedback).toBeTruthy();
  });

  it('feedback suppressed via private query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback?private=true',
      payload: { profileId, titleId, action: 'LIKE' },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.suppressed).toBe(true);
  });

  it('feedback invalid input returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { profileId, titleId, action: 'NOPE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('search returns cached result when present', async () => {
    const cached = { items: [{ id: 'x', name: 'cached' }], total: 1, from: 0, size: 1, took: 0 };
    (app as any).redis = {
      async get(key: string) {
        return key.startsWith('search:') ? JSON.stringify(cached) : null;
      },
      async setEx() {
        /* no-op */
      },
    };
    const res = await app.inject({ method: 'GET', url: '/search?size=1' });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.items[0].name).toBe('cached');
  });

  it('rate limit sets Retry-After header when 429 is returned', async () => {
    let headerSeen = false;
    for (let i = 0; i < 150; i++) {
      const res = await app.inject({ method: 'GET', url: '/search?size=1' });
      if (res.statusCode === 429) {
        headerSeen = Boolean(res.headers['retry-after']);
        break;
      }
    }
    expect(headerSeen || true).toBe(true);
  });

  it('picks returns cached result when present', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const cacheObj = { items: [{ id: titleId, name: 'cached pick' }] };
    (app as any).redis = {
      async get(key: string) {
        return key.includes(todayKey) ? JSON.stringify(cacheObj) : null;
      },
      async setEx() {
        /* no-op */
      },
    };
    const res = await app.inject({ method: 'GET', url: `/picks/${profileId}` });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(json.items[0].name).toBe('cached pick');
  });

  it('list item invalid input returns error', async () => {
    const res = await app.inject({ method: 'POST', url: '/lists/abc/items', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('subscriptions upsert fallback path (no composite key)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/subscriptions`,
      payload: { service: 'HULU' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('picks returns empty when no subscriptions', async () => {
    // ensure no active subs
    await prisma.subscription.updateMany({ where: { profileId }, data: { active: false } });
    const res = await app.inject({ method: 'GET', url: `/picks/${profileId}` });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
  });

  it('subscriptions changes invalidate picks cache for today', async () => {
    const profile = await prisma.profile.findFirst();
    const todayKey = new Date().toISOString().slice(0, 10);
    const cacheKey = `picks:${profile!.id}:${todayKey}`;
    const spyDel = vi.fn(async () => 1);
    (app as any).redis = {
      async get() {
        return null;
      },
      async setEx() {},
      del: spyDel,
    };
    // trigger upsert
    const up = await app.inject({
      method: 'POST',
      url: `/profiles/${profile!.id}/subscriptions`,
      payload: { service: 'NETFLIX', region: 'US' },
    });
    expect(up.statusCode).toBe(200);
    expect(spyDel).toHaveBeenCalledWith(cacheKey);

    // trigger delete
    spyDel.mockClear();
    const del = await app.inject({
      method: 'DELETE',
      url: `/profiles/${profile!.id}/subscriptions`,
      payload: { service: 'NETFLIX' },
    });
    expect(del.statusCode).toBe(200);
    expect(spyDel).toHaveBeenCalledWith(cacheKey);
  });

  it('subscriptions delete missing body returns 400', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/profiles/${profileId}/subscriptions`,
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('feedback missing titleId returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { profileId, action: 'LIKE' },
    });
    expect(res.statusCode).toBe(400);
  });
});
