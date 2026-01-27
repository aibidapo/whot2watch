import { describe, it, expect, vi } from 'vitest';
import type { QualityReport } from './dataQuality';

// Mock PrismaClient for unit tests
function makeMockPrisma(overrides: {
  titleCount?: number | ((args?: any) => number | Promise<number>);
  availabilityCount?: number | ((args?: any) => number | Promise<number>);
  queryRawDuplicates?: { count: bigint }[];
  availabilityDeleteMany?: { count: number };
  queryRawAvailDupes?: any[];
  availabilityFindMany?: any[];
}) {
  const titleCount =
    typeof overrides.titleCount === 'function'
      ? vi.fn().mockImplementation(overrides.titleCount)
      : vi.fn().mockResolvedValue(overrides.titleCount ?? 0);
  const availCount =
    typeof overrides.availabilityCount === 'function'
      ? vi.fn().mockImplementation(overrides.availabilityCount)
      : vi.fn().mockResolvedValue(overrides.availabilityCount ?? 0);

  return {
    title: { count: titleCount },
    availability: {
      count: availCount,
      deleteMany: vi.fn().mockResolvedValue(overrides.availabilityDeleteMany ?? { count: 0 }),
      findMany: vi.fn().mockResolvedValue(overrides.availabilityFindMany ?? []),
    },
    $queryRaw: vi.fn().mockResolvedValue(overrides.queryRawDuplicates ?? [{ count: BigInt(0) }]),
  } as any;
}

describe('runQualityChecks', () => {
  it('returns full report with completeness score', async () => {
    const { runQualityChecks } = await import('./dataQuality');
    let callIdx = 0;
    const prisma = makeMockPrisma({
      titleCount: (args?: any) => {
        callIdx++;
        // 1st call: total, 2-5: missing fields, last: complete count
        if (callIdx === 1) return Promise.resolve(100);
        if (callIdx <= 5) return Promise.resolve(10);
        return Promise.resolve(60);
      },
      availabilityCount: () => Promise.resolve(5),
      queryRawDuplicates: [{ count: BigInt(3) }],
    });
    const report: QualityReport = await runQualityChecks(prisma);
    expect(report.totalTitles).toBe(100);
    expect(report.missingPoster).toBe(10);
    expect(report.missingImdbId).toBe(10);
    expect(report.missingVoteAverage).toBe(10);
    expect(report.missingPopularity).toBe(10);
    expect(report.duplicateNames).toBe(3);
    expect(report.staleAvailability).toBe(5);
    expect(report.completenessScore).toBe(60);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it('returns 100 completeness when no titles exist', async () => {
    const { runQualityChecks } = await import('./dataQuality');
    const prisma = makeMockPrisma({
      titleCount: 0,
      availabilityCount: 0,
      queryRawDuplicates: [{ count: BigInt(0) }],
    });
    const report = await runQualityChecks(prisma);
    expect(report.totalTitles).toBe(0);
    expect(report.completenessScore).toBe(100);
    expect(report.issues).toHaveLength(0);
  });
});

describe('cleanStaleAvailability', () => {
  it('deletes stale rows and returns count', async () => {
    const { cleanStaleAvailability } = await import('./dataQuality');
    const prisma = makeMockPrisma({ availabilityDeleteMany: { count: 7 } });
    const deleted = await cleanStaleAvailability(prisma, 30);
    expect(deleted).toBe(7);
    expect(prisma.availability.deleteMany).toHaveBeenCalled();
  });
});

describe('deduplicateAvailability', () => {
  it('removes duplicates keeping newest', async () => {
    const { deduplicateAvailability } = await import('./dataQuality');
    const prisma = makeMockPrisma({
      queryRawDuplicates: [],
      availabilityFindMany: [
        { id: 'keep', lastSeenAt: new Date() },
        { id: 'remove', lastSeenAt: new Date(Date.now() - 100000) },
      ],
      availabilityDeleteMany: { count: 1 },
    });
    // Override $queryRaw for dedup query
    prisma.$queryRaw = vi
      .fn()
      .mockResolvedValue([
        {
          titleId: 't1',
          service: 'NETFLIX',
          region: 'US',
          offerType: 'SUBSCRIPTION',
          cnt: BigInt(2),
        },
      ]);
    const removed = await deduplicateAvailability(prisma);
    expect(removed).toBe(1);
  });

  it('returns 0 when no duplicates exist', async () => {
    const { deduplicateAvailability } = await import('./dataQuality');
    const prisma = makeMockPrisma({ queryRawDuplicates: [] });
    prisma.$queryRaw = vi.fn().mockResolvedValue([]);
    const removed = await deduplicateAvailability(prisma);
    expect(removed).toBe(0);
  });
});
