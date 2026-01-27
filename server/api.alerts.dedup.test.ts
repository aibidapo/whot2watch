import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

let serverUrl = 'http://localhost:4014';
const prisma = new PrismaClient();

let dbReady = true;
beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  await app.listen({ port: 4014, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('Alert dedup on POST', () => {
  it.skipIf(!dbReady)('returns existing alert with idempotent flag on duplicate', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    const title = await prisma.title.findFirst();
    if (!title) return;

    // Clean up any existing alerts for this combo
    await prisma.alert.deleteMany({
      where: {
        profileId: profile.id,
        titleId: title.id,
        alertType: 'AVAILABILITY',
        region: 'US',
      },
    });

    const body = JSON.stringify({
      titleId: title.id,
      services: ['NETFLIX'],
      region: 'US',
    });
    const headers = { 'content-type': 'application/json', 'x-user-id': profile.userId };

    // First create
    const res1 = await fetch(`${serverUrl}/profiles/${profile.id}/alerts`, {
      method: 'POST',
      headers,
      body,
    });
    expect(res1.ok).toBe(true);
    const json1 = await res1.json();
    expect(json1.alert).toBeTruthy();
    expect(json1.idempotent).toBeUndefined();

    // Duplicate create — should return existing
    const res2 = await fetch(`${serverUrl}/profiles/${profile.id}/alerts`, {
      method: 'POST',
      headers,
      body,
    });
    expect(res2.ok).toBe(true);
    const json2 = await res2.json();
    expect(json2.alert.id).toBe(json1.alert.id);
    expect(json2.idempotent).toBe(true);

    // Cleanup
    await prisma.alert.delete({ where: { id: json1.alert.id } }).catch(() => {});
  });
});
