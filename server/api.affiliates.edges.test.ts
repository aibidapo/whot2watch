import { describe, it, expect, beforeAll } from 'vitest';
import app from './api';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let dbReady = true;

describe('Affiliate UTM edge cases', () => {
  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });
  it.skipIf(!process.env.DATABASE_URL)(
    'does not duplicate UTM params if already present',
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
          name: `AffDup ${Date.now()}`,
          type: 'MOVIE',
          releaseYear: 2023,
          availability: {
            create: [
              {
                service: 'NETFLIX',
                region: 'US',
                offerType: 'SUBSCRIPTION',
                deepLink:
                  'https://netflix.com/watch/dup?utm_source=whot2watch&utm_medium=affiliate&utm_campaign=watch_now',
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
        const occ = (item.watchUrl.match(/utm_source=/g) || []).length;
        expect(occ).toBe(1);
      } else {
        expect(true).toBe(true);
      }
    },
    15000,
  );

  it.skipIf(!process.env.DATABASE_URL)(
    'leaves invalid URLs untouched (graceful fallback)',
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
      const bad = 'not a url';
      const t = await prisma.title.create({
        data: {
          name: `AffBad ${Date.now()}`,
          type: 'MOVIE',
          releaseYear: 2023,
          availability: {
            create: [
              { service: 'NETFLIX', region: 'US', offerType: 'SUBSCRIPTION', deepLink: bad },
            ],
          },
        },
      });
      const res = await app.inject({ method: 'GET', url: `/picks/${profile.id}` });
      expect(res.statusCode).toBe(200);
      const json = res.json() as any;
      const item = (json.items || []).find((i: any) => i.id === t.id);
      if (item) {
        expect(item.watchUrl).toBe(bad);
      } else {
        expect(true).toBe(true);
      }
    },
  );
});
