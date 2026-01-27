import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

let serverUrl = 'http://localhost:4013';
const prisma = new PrismaClient();

let dbReady = true;
beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  await app.listen({ port: 4013, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('Notification Preferences', () => {
  it.skipIf(!dbReady)('GET returns defaults when no preference exists', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    // Clean up first
    await (prisma as any).notificationPreference
      .deleteMany({ where: { profileId: profile.id } })
      .catch(() => {});
    const res = await fetch(`${serverUrl}/profiles/${profile.id}/notification-preferences`, {
      headers: { 'x-user-id': profile.userId },
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.pushEnabled).toBe(true);
    expect(json.consentGiven).toBe(false);
  });

  it.skipIf(!dbReady)('PUT upserts preferences and sets consent timestamp', async () => {
    const profile = await prisma.profile.findFirst();
    if (!profile) return;
    const res = await fetch(`${serverUrl}/profiles/${profile.id}/notification-preferences`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-user-id': profile.userId },
      body: JSON.stringify({
        pushEnabled: true,
        emailEnabled: true,
        consentGiven: true,
        frequencyCap: 5,
      }),
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.emailEnabled).toBe(true);
    expect(json.consentGiven).toBe(true);
    expect(json.consentTs).toBeTruthy();
    // Cleanup
    await (prisma as any).notificationPreference
      .deleteMany({ where: { profileId: profile.id } })
      .catch(() => {});
  });
});
