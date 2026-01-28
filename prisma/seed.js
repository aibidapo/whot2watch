/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const SEED_PROFILE_ID = '9f6e8a4d-4194-406a-9acb-b5d19b54c1ec';
const SEED_USER_ID = 'seed-dev-user-001';

// Multi-region seed data for better development/testing coverage
const SEED_REGIONS = ['US', 'CA', 'GB'];
const SEED_SERVICES = ['NETFLIX', 'AMAZON_PRIME_VIDEO', 'DISNEY_PLUS'];

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: 'dev@example.com' },
      update: {},
      create: { id: SEED_USER_ID, email: 'dev@example.com', region: 'US', authProvider: 'supabase' },
    });
    const profile = await prisma.profile.upsert({
      where: { id: SEED_PROFILE_ID },
      update: {},
      create: { id: SEED_PROFILE_ID, userId: user.id, name: 'Dev', locale: 'en-US', privateModeDefault: false },
    });
    await prisma.subscription.createMany({
      data: [
        { profileId: profile.id, service: 'NETFLIX', region: 'US' },
        { profileId: profile.id, service: 'HULU', region: 'US' },
      ],
      skipDuplicates: true,
    });
    const title = await prisma.title.create({
      data: {
        type: 'MOVIE',
        name: 'Seed Example',
        releaseYear: 2024,
        runtimeMin: 95,
        genres: ['COMEDY'],
        moods: ['feel_good'],
      },
    });
    // Create multi-region, multi-service availability for better dev/test coverage
    for (const region of SEED_REGIONS) {
      for (const service of SEED_SERVICES) {
        await prisma.availability.upsert({
          where: {
            titleId_service_region_offerType: {
              titleId: title.id,
              service,
              region,
              offerType: 'SUBSCRIPTION',
            },
          },
          update: {},
          create: { titleId: title.id, service, region, offerType: 'SUBSCRIPTION' },
        });
      }
    }
    console.log(`Seed completed: created availability for ${SEED_REGIONS.length} regions × ${SEED_SERVICES.length} services`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
