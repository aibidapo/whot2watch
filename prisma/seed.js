/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: 'dev@example.com' },
      update: {},
      create: { email: 'dev@example.com', region: 'US', authProvider: 'supabase' }
    });
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: 'Dev', locale: 'en-US', privateModeDefault: false }
    });
    await prisma.subscription.createMany({
      data: [
        { profileId: profile.id, service: 'NETFLIX', region: 'US' },
        { profileId: profile.id, service: 'HULU', region: 'US' }
      ],
      skipDuplicates: true
    });
    const title = await prisma.title.create({
      data: {
        type: 'MOVIE',
        name: 'Seed Example',
        releaseYear: 2024,
        runtimeMin: 95,
        genres: ['COMEDY'],
        moods: ['feel_good']
      }
    });
    await prisma.availability.create({
      data: { titleId: title.id, service: 'NETFLIX', region: 'US', offerType: 'SUBSCRIPTION' }
    });
    console.log('Seed completed');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
