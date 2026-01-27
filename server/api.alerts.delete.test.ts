import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

let serverUrl = 'http://localhost:4011';
const prisma = new PrismaClient();

let dbReady = true;
beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  await app.listen({ port: 4011, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('DELETE /profiles/:profileId/alerts/:alertId', () => {
  it.skipIf(!dbReady)('cancels an alert and returns updated status', async () => {
    // Create a profile + alert
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    const alert = await prisma.alert.create({
      data: {
        profileId: profile.id,
        alertType: 'AVAILABILITY',
        services: ['NETFLIX'],
        region: 'US',
        status: 'ACTIVE',
      },
    });
    const res = await fetch(`${serverUrl}/profiles/${profile.id}/alerts/${alert.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': profile.userId },
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.alert.status).toBe('CANCELLED');
    // Cleanup
    await prisma.alert.delete({ where: { id: alert.id } }).catch(() => {});
  });

  it('returns 404 for non-existent alert', async () => {
    const res = await fetch(
      `${serverUrl}/profiles/00000000-0000-0000-0000-000000000001/alerts/00000000-0000-0000-0000-000000000099`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': '00000000-0000-0000-0000-000000000001' },
      },
    );
    expect(res.status).toBe(404);
  });

  it.skipIf(!dbReady)('returns 403 when alert belongs to different profile', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    const alert = await prisma.alert.create({
      data: {
        profileId: profile.id,
        alertType: 'AVAILABILITY',
        services: ['NETFLIX'],
        region: 'US',
        status: 'ACTIVE',
      },
    });
    const res = await fetch(
      `${serverUrl}/profiles/00000000-0000-0000-0000-000000000099/alerts/${alert.id}`,
      {
        method: 'DELETE',
        headers: { 'x-user-id': '00000000-0000-0000-0000-000000000099' },
      },
    );
    expect(res.status).toBe(403);
    await prisma.alert.delete({ where: { id: alert.id } }).catch(() => {});
  });
});
