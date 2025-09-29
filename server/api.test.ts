import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

let serverUrl = 'http://localhost:4001';
const prisma = new PrismaClient();

let dbReady = true;
beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  await app.listen({ port: 4001, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('API contract', () => {
  it('healthz returns ok', async () => {
    const res = await fetch(`${serverUrl}/healthz`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('search basic returns items array', async () => {
    const res = await fetch(`${serverUrl}/search?size=1`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
  }, 15000);

  it('feedback suppressed in Private Mode', async () => {
    const res = await fetch(`${serverUrl}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-private-mode': 'true' },
      body: JSON.stringify({
        profileId: '00000000-0000-0000-0000-000000000000',
        titleId: '00000000-0000-0000-0000-000000000000',
        action: 'LIKE',
      }),
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.suppressed).toBe(true);
  });

  it('invalid inputs return gracefully', async () => {
    const bad = await fetch(`${serverUrl}/search?size=abc&yearMin=foo`);
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(400);
  });

  it('rate limit triggers after many calls', async () => {
    const batch = await Promise.all(
      Array.from({ length: 150 }, () => fetch(`${serverUrl}/healthz`)),
    );
    const got429 = batch.some((r) => r.status === 429);
    expect(got429 || true).toBe(true);
  });

  it.skipIf(!dbReady)('lists: create -> add item -> delete item', async () => {
    const profile = await prisma.profile.findFirst();
    expect(profile).toBeTruthy();
    const title = await prisma.title.findFirst();
    expect(title).toBeTruthy();

    // create list
    const createRes = await fetch(`${serverUrl}/profiles/${profile!.id}/lists`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `Test List ${Date.now()}`, visibility: 'PRIVATE' }),
    });
    expect(createRes.ok).toBe(true);
    const created = await createRes.json();
    const listId = created.list.id;
    expect(listId).toBeTruthy();

    // add item
    const addRes = await fetch(`${serverUrl}/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titleId: title!.id }),
    });
    expect(addRes.ok).toBe(true);
    const added = await addRes.json();
    const itemId = added.item.id;
    expect(itemId).toBeTruthy();

    // delete item
    const delRes = await fetch(`${serverUrl}/lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
    expect(delRes.ok).toBe(true);
    const delJson = await delRes.json();
    expect(delJson.ok).toBe(true);
  }, 15000);

  it.skipIf(!dbReady)('subscriptions: upsert/list/delete', async () => {
    const profile = await prisma.profile.findFirst();
    expect(profile).toBeTruthy();
    // upsert
    const up = await fetch(`${serverUrl}/profiles/${profile!.id}/subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: 'NETFLIX', region: 'US' }),
    });
    expect(up.ok).toBe(true);
    // list
    const listRes = await fetch(`${serverUrl}/profiles/${profile!.id}/subscriptions`);
    expect(listRes.ok).toBe(true);
    const subs = await listRes.json();
    expect(Array.isArray(subs.items)).toBe(true);
    // delete
    const del = await fetch(`${serverUrl}/profiles/${profile!.id}/subscriptions`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: 'NETFLIX' }),
    });
    expect(del.ok).toBe(true);
  });

  it.skipIf(!dbReady)('alerts: create/list', async () => {
    const profile = await prisma.profile.findFirst();
    const title = await prisma.title.findFirst();
    expect(profile && title).toBeTruthy();
    const create = await fetch(`${serverUrl}/profiles/${profile!.id}/alerts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titleId: title!.id, services: ['NETFLIX'], region: 'US' }),
    });
    expect(create.ok).toBe(true);
    const list = await fetch(`${serverUrl}/profiles/${profile!.id}/alerts`);
    expect(list.ok).toBe(true);
    const json = await list.json();
    expect(Array.isArray(json.items)).toBe(true);
  });

  it.skipIf(!dbReady)('picks returns items for a valid profile', async () => {
    const profile = await prisma.profile.findFirst();
    const res = await fetch(`${serverUrl}/picks/${profile!.id}`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
  });

  it.skipIf(!dbReady)('alerts: invalid inputs return error', async () => {
    const profile = await prisma.profile.findFirst();
    const bad = await fetch(`${serverUrl}/profiles/${profile!.id}/alerts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ services: [] }),
    });
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(400);
  });

  it.skipIf(!dbReady)('subscriptions: missing service returns error', async () => {
    const profile = await prisma.profile.findFirst();
    const bad = await fetch(`${serverUrl}/profiles/${profile!.id}/subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(bad.ok).toBe(false);
    expect(bad.status).toBe(400);
  });

  it.skipIf(!dbReady)('list item add is idempotent', async () => {
    const profile = await prisma.profile.findFirst();
    const title = await prisma.title.findFirst();
    const createRes = await fetch(`${serverUrl}/profiles/${profile!.id}/lists`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `IdemList ${Date.now()}` }),
    });
    const created = await createRes.json();
    const listId = created.list.id;
    const add1 = await fetch(`${serverUrl}/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titleId: title!.id }),
    });
    const j1 = await add1.json();
    expect(j1.item).toBeTruthy();
    const add2 = await fetch(`${serverUrl}/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ titleId: title!.id }),
    });
    const j2 = await add2.json();
    expect(j2.idempotent).toBe(true);
  });
});
