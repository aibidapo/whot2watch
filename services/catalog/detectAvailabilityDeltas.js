/* eslint-disable no-console */
/**
 * Availability Delta Detection — Epic 5
 *
 * Compares recently-refreshed Availability records against ACTIVE alerts.
 * When a match is found (titleId + service + region), fires the alert and
 * enqueues a push notification via NotificationLog.
 *
 * Usage: node -r ./scripts/load-env.cjs services/catalog/detectAvailabilityDeltas.js
 */
const { PrismaClient } = require('@prisma/client');

const DELTA_THRESHOLD_HOURS = Number(process.env.DELTA_THRESHOLD_HOURS || 48);
const DELTA_BATCH_SIZE = Number(process.env.DELTA_BATCH_SIZE || 500);
const DEDUP_WINDOW_HOURS = 24;

async function main() {
  const prisma = new PrismaClient();
  const start = Date.now();
  let titlesScanned = 0;
  let deltasFound = 0;
  let notificationsSent = 0;

  try {
    const thresholdDate = new Date(Date.now() - DELTA_THRESHOLD_HOURS * 60 * 60 * 1000);
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

    // Find availability records updated recently (within threshold)
    const freshAvail = await prisma.availability.findMany({
      where: { lastSeenAt: { gte: thresholdDate } },
      select: { titleId: true, service: true, region: true },
      take: DELTA_BATCH_SIZE,
    });

    titlesScanned = freshAvail.length;
    console.log(`[delta] Scanning ${titlesScanned} fresh availability records`);

    // Build unique (titleId, region) pairs
    const pairs = new Map();
    for (const a of freshAvail) {
      const key = `${a.titleId}:${a.region}`;
      if (!pairs.has(key)) pairs.set(key, { titleId: a.titleId, region: a.region, services: [] });
      pairs.get(key).services.push(a.service);
    }

    for (const [, entry] of pairs) {
      // Find ACTIVE alerts matching this titleId+region
      const alerts = await prisma.alert.findMany({
        where: {
          titleId: entry.titleId,
          region: entry.region,
          status: 'ACTIVE',
        },
      });

      for (const alert of alerts) {
        // Check if any of the alert's services overlap with the fresh availability
        const alertServices = alert.services || [];
        const hasOverlap =
          alertServices.length === 0 ||
          alertServices.some((s) => entry.services.includes(s));
        if (!hasOverlap) continue;

        // Dedup: skip if NotificationLog entry exists within window
        const recentLog = await prisma.notificationLog.findFirst({
          where: {
            alertId: alert.id,
            sentAt: { gte: dedupCutoff },
          },
        });
        if (recentLog) continue;

        deltasFound++;

        // Fire the alert
        await prisma.alert.update({
          where: { id: alert.id },
          data: { status: 'FIRED', firedAt: new Date() },
        });

        // Create notification log entry
        await prisma.notificationLog.create({
          data: {
            alertId: alert.id,
            profileId: alert.profileId,
            channel: 'PUSH',
            status: 'SENT',
          },
        });
        notificationsSent++;
      }
    }

    const durationMs = Date.now() - start;
    console.log(
      `[delta] Done: titlesScanned=${titlesScanned}, deltasFound=${deltasFound}, notificationsSent=${notificationsSent}, duration=${durationMs}ms`,
    );
  } catch (err) {
    console.error('[delta] Error:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
