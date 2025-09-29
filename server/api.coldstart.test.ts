import { describe, it, expect } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Cold-start blending and quality fallback', () => {
  it('when no subscriptions, uses quality blend and adds qualityFallback flag', async () => {
    // Create isolated user/profile with no subscriptions
    const user = await prisma.user.create({
      data: { email: `coldstart-${Date.now()}@example.com` },
    });
    const profile = await prisma.profile.create({ data: { userId: user.id, name: 'ColdStart' } });
    // Ensure cache does not return stale picks
    (app as any).redis = { get: async () => null, setEx: async () => {} };
    const res = await app.inject({ method: 'GET', url: `/picks/${profile.id}` });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(Array.isArray(json.items)).toBe(true);
    // qualityFallback flag appears on items
    const hasFlag = json.items.some((i: any) => i.qualityFallback === true);
    expect(hasFlag).toBe(true);
    // reason mentions quality blend
    const hasQualityReason = json.items.some((i: any) =>
      String(i.reason).includes('quality blend'),
    );
    expect(hasQualityReason).toBe(true);
  }, 15000);
});
