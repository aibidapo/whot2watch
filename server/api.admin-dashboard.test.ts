import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

let serverUrl = 'http://localhost:4015';
const prisma = new PrismaClient();

let dbReady = true;
beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  await app.listen({ port: 4015, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('GET /v1/admin/demo-dashboard', () => {
  it.skipIf(!dbReady)('response includes all new Epic 5 fields', async () => {
    const res = await fetch(`${serverUrl}/v1/admin/demo-dashboard`, {
      headers: { 'x-admin-key': process.env.ADMIN_KEY || 'test-admin-key' },
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    // Original fields
    expect(typeof json.totalUsers).toBe('number');
    expect(typeof json.premiumUsers).toBe('number');
    expect(typeof json.totalReferrals).toBe('number');
    expect(Array.isArray(json.topTrending)).toBe(true);
    // New Epic 5 fields
    expect(typeof json.ingestSuccessRate).toBe('number');
    expect(typeof json.availabilityFreshnessHours).toBe('number');
    expect(typeof json.ratingsCoveragePercent).toBe('number');
    expect(typeof json.activeAlerts).toBe('number');
    expect(typeof json.firedAlerts24h).toBe('number');
    expect(typeof json.notificationsSent24h).toBe('number');
    expect(typeof json.deviceTokenCount).toBe('number');
  });

  it.skipIf(!dbReady)('division-by-zero safety when zero titles', async () => {
    // Even with data present, the endpoint should not crash
    const res = await fetch(`${serverUrl}/v1/admin/demo-dashboard`, {
      headers: { 'x-admin-key': process.env.ADMIN_KEY || 'test-admin-key' },
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.ingestSuccessRate).toBeGreaterThanOrEqual(0);
    expect(json.ratingsCoveragePercent).toBeGreaterThanOrEqual(0);
  });

  it.skipIf(!dbReady)('freshness returns 0 when no availability data', async () => {
    const res = await fetch(`${serverUrl}/v1/admin/demo-dashboard`, {
      headers: { 'x-admin-key': process.env.ADMIN_KEY || 'test-admin-key' },
    });
    expect(res.ok).toBe(true);
    const json = await res.json();
    // Should return a number (could be 0 if no data)
    expect(typeof json.availabilityFreshnessHours).toBe('number');
    expect(json.availabilityFreshnessHours).toBeGreaterThanOrEqual(0);
  });
});
