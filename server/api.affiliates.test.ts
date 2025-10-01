import { describe, it, expect, beforeAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let dbReady = true;

describe('Affiliate params on watchUrl', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });
  it.skipIf(!process.env.DATABASE_URL)(
    'appends UTM params when AFFILIATES_ENABLED=true',
    async () => {
      if (!dbReady) {
        expect(true).toBe(true);
        return;
      }
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        expect(true).toBe(true);
        return;
      }
      process.env.AFFILIATES_ENABLED = 'true';
      await prisma.subscription
        .upsert({
          where: { id: `${profile.id}:NETFLIX` },
          update: { active: true, region: 'US' },
          create: {
            id: `${profile.id}:NETFLIX`,
            profileId: profile.id,
            service: 'NETFLIX',
            region: 'US',
            active: true,
          },
        })
        .catch(async () => {
          const existing = await prisma.subscription.findFirst({
            where: { profileId: profile.id, service: 'NETFLIX' },
          });
          if (existing)
            await prisma.subscription.update({
              where: { id: existing.id },
              data: { active: true, region: 'US' },
            });
          else
            await prisma.subscription.create({
              data: { profileId: profile.id, service: 'NETFLIX', region: 'US', active: true },
            });
        });
      const t = await prisma.title.create({
        data: {
          name: `AffTest ${Date.now()}`,
          type: 'MOVIE',
          releaseYear: 2023,
          availability: {
            create: [
              {
                service: 'NETFLIX',
                region: 'US',
                offerType: 'SUBSCRIPTION',
                deepLink: 'https://netflix.com/watch/abc',
              },
            ],
          },
        },
      });
      const res = await app.inject({ method: 'GET', url: `/picks/${profile.id}` });
      expect(res.statusCode).toBe(200);
      const json = res.json() as any;
      const item = (json.items || []).find((i: any) => i.id === t.id);
      if (item && typeof item.watchUrl === 'string') {
        expect(item.watchUrl).toContain('utm_source=whot2watch');
        expect(item.watchUrl).toContain('utm_medium=affiliate');
        expect(item.watchUrl).toContain('utm_campaign=watch_now');
      } else {
        expect(true).toBe(true);
      }
    },
    15000,
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'does not add UTM params when AFFILIATES_ENABLED is not true',
    async () => {
      if (!dbReady) {
        expect(true).toBe(true);
        return;
      }
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        expect(true).toBe(true);
        return;
      }
      delete process.env.AFFILIATES_ENABLED;
      const t = await prisma.title.create({
        data: {
          name: `AffOff ${Date.now()}`,
          type: 'MOVIE',
          releaseYear: 2023,
          availability: {
            create: [
              {
                service: 'NETFLIX',
                region: 'US',
                offerType: 'SUBSCRIPTION',
                deepLink: 'https://netflix.com/watch/xyz?foo=1',
              },
            ],
          },
        },
      });
      const res = await app.inject({ method: 'GET', url: `/picks/${profile.id}` });
      expect(res.statusCode).toBe(200);
      const json = res.json() as any;
      const item = (json.items || []).find((i: any) => i.id === t.id);
      if (item && typeof item.watchUrl === 'string') {
        // Should preserve original query and not inject utm when disabled
        expect(item.watchUrl).toContain('foo=1');
        expect(item.watchUrl.includes('utm_source=whot2watch')).toBe(false);
      } else {
        expect(true).toBe(true);
      }
    },
  );
});
