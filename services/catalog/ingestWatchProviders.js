/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { fetchWatchProviders } = require('./tmdb');
const { canonicalizeProvider } = require('./providerAlias');

async function upsertAvailability(prisma, titleId, region, offerType, providers) {
  for (const p of providers || []) {
    const rawName = p.provider_name || p.providerName || p.name || '';
    const service = canonicalizeProvider(rawName);
    if (!service || service === 'OTHER') continue;
    const deepLink = p.link || undefined;
    const existing = await prisma.availability.findFirst({
      where: { titleId, region, service, offerType },
      select: { id: true },
    });
    if (existing?.id) {
      await prisma.availability.update({
        where: { id: existing.id },
        data: { deepLink: deepLink || null, lastSeenAt: new Date() },
      });
    } else {
      await prisma.availability.create({
        data: {
          titleId,
          service,
          region,
          offerType,
          deepLink: deepLink || null,
          lastSeenAt: new Date(),
        },
      });
    }
  }
}

async function main() {
  const prisma = new PrismaClient();
  const regionsEnv = process.env.WATCH_PROVIDERS_REGIONS || 'US,CA,GB';
  const regions = regionsEnv
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const take = Number(process.env.WATCH_PROVIDERS_TAKE || 50);
  try {
    const titles = await prisma.title.findMany({
      take,
      where: { tmdbId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tmdbId: true, type: true },
    });
    let updates = 0;
    for (const t of titles) {
      try {
        const media = t.type === 'SHOW' ? 'tv' : 'movie';
        const data = await fetchWatchProviders(media, String(t.tmdbId));
        const results = data?.results || {};
        for (const region of regions) {
          const r = results[region];
          if (!r) continue;
          await upsertAvailability(prisma, t.id, region, 'SUBSCRIPTION', r.flatrate);
          await upsertAvailability(prisma, t.id, region, 'RENT', r.rent);
          await upsertAvailability(prisma, t.id, region, 'BUY', r.buy);
          await upsertAvailability(prisma, t.id, region, 'FREE', r.free);
          await upsertAvailability(prisma, t.id, region, 'ADS', r.ads);
        }
        updates++;
      } catch (err) {
        console.warn(`[watch-providers] skip ${t.id}: ${String(err)}`);
      }
    }
    console.log(`[watch-providers] updated availability for ${updates} titles`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
