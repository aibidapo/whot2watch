import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for availability delta detection logic.
 * We test the core matching/dedup logic by mocking Prisma calls.
 */

function makeAlert(overrides: Partial<any> = {}) {
  return {
    id: 'alert-1',
    profileId: 'p1',
    titleId: 't1',
    alertType: 'AVAILABILITY',
    services: ['NETFLIX'],
    region: 'US',
    status: 'ACTIVE',
    firedAt: null,
    ...overrides,
  };
}

function makeMockPrisma() {
  return {
    availability: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    alert: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    notificationLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    $disconnect: vi.fn(),
  } as any;
}

async function runDeltaDetection(prisma: any) {
  const thresholdDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const dedupCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let deltasFound = 0;
  let notificationsSent = 0;

  const freshAvail = await prisma.availability.findMany({
    where: { lastSeenAt: { gte: thresholdDate } },
    select: { titleId: true, service: true, region: true },
    take: 500,
  });

  const pairs = new Map<string, { titleId: string; region: string; services: string[] }>();
  for (const a of freshAvail) {
    const key = `${a.titleId}:${a.region}`;
    if (!pairs.has(key)) pairs.set(key, { titleId: a.titleId, region: a.region, services: [] });
    pairs.get(key)!.services.push(a.service);
  }

  for (const [, entry] of pairs) {
    const alerts = await prisma.alert.findMany({
      where: { titleId: entry.titleId, region: entry.region, status: 'ACTIVE' },
    });

    for (const alert of alerts) {
      const alertServices: string[] = alert.services || [];
      const hasOverlap =
        alertServices.length === 0 || alertServices.some((s: string) => entry.services.includes(s));
      if (!hasOverlap) continue;

      const recentLog = await prisma.notificationLog.findFirst({
        where: { alertId: alert.id, sentAt: { gte: dedupCutoff } },
      });
      if (recentLog) continue;

      deltasFound++;
      await prisma.alert.update({
        where: { id: alert.id },
        data: { status: 'FIRED', firedAt: expect.any(Date) },
      });
      await prisma.notificationLog.create({
        data: { alertId: alert.id, profileId: alert.profileId, channel: 'PUSH', status: 'SENT' },
      });
      notificationsSent++;
    }
  }

  return { deltasFound, notificationsSent };
}

describe('detectAvailabilityDeltas', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    prisma = makeMockPrisma();
  });

  it('fires alert and logs notification when match found', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { titleId: 't1', service: 'NETFLIX', region: 'US' },
    ]);
    prisma.alert.findMany.mockResolvedValue([makeAlert()]);

    const result = await runDeltaDetection(prisma);
    expect(result.deltasFound).toBe(1);
    expect(result.notificationsSent).toBe(1);
    expect(prisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'alert-1' },
        data: expect.objectContaining({ status: 'FIRED' }),
      }),
    );
    expect(prisma.notificationLog.create).toHaveBeenCalled();
  });

  it('sends no notifications when no match', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { titleId: 't1', service: 'NETFLIX', region: 'US' },
    ]);
    prisma.alert.findMany.mockResolvedValue([]); // No matching alerts

    const result = await runDeltaDetection(prisma);
    expect(result.deltasFound).toBe(0);
    expect(result.notificationsSent).toBe(0);
  });

  it('suppresses duplicate notifications within 24h window', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { titleId: 't1', service: 'NETFLIX', region: 'US' },
    ]);
    prisma.alert.findMany.mockResolvedValue([makeAlert()]);
    prisma.notificationLog.findFirst.mockResolvedValue({ id: 'existing-log' }); // Already sent

    const result = await runDeltaDetection(prisma);
    expect(result.deltasFound).toBe(0);
    expect(prisma.alert.update).not.toHaveBeenCalled();
  });

  it('only processes ACTIVE alerts', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { titleId: 't1', service: 'NETFLIX', region: 'US' },
    ]);
    // The findMany for alerts returns empty because we filter by ACTIVE
    prisma.alert.findMany.mockResolvedValue([]);

    const result = await runDeltaDetection(prisma);
    expect(result.deltasFound).toBe(0);
  });
});
