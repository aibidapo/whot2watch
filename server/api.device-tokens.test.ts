import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

let serverUrl = 'http://localhost:4012';
const prisma = new PrismaClient();

let dbReady = true;
beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  await app.listen({ port: 4012, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /profiles/:profileId/device-tokens', () => {
  it.skipIf(!dbReady)('registers a device token', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    const res = await fetch(`${serverUrl}/profiles/${profile.id}/device-tokens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': profile.userId },
      body: JSON.stringify({ token: 'test-token-123', platform: 'WEB' }),
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.token).toBe('test-token-123');
    expect(json.platform).toBe('WEB');
    // Cleanup
    await (prisma as any).deviceToken
      .deleteMany({ where: { profileId: profile.id, token: 'test-token-123' } })
      .catch(() => {});
  });

  it.skipIf(!dbReady)('duplicate registration is idempotent', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    const body = JSON.stringify({ token: 'dup-token-456', platform: 'IOS' });
    const headers = { 'content-type': 'application/json', 'x-user-id': profile.userId };
    const res1 = await fetch(`${serverUrl}/profiles/${profile.id}/device-tokens`, {
      method: 'POST',
      headers,
      body,
    });
    expect(res1.ok).toBe(true);
    const res2 = await fetch(`${serverUrl}/profiles/${profile.id}/device-tokens`, {
      method: 'POST',
      headers,
      body,
    });
    expect(res2.ok).toBe(true);
    // Should not create duplicate
    const count = await (prisma as any).deviceToken.count({
      where: { profileId: profile.id, token: 'dup-token-456' },
    });
    expect(count).toBe(1);
    // Cleanup
    await (prisma as any).deviceToken
      .deleteMany({ where: { profileId: profile.id, token: 'dup-token-456' } })
      .catch(() => {});
  });
});
