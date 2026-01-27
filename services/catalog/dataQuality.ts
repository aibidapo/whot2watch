/**
 * Data Quality Pipeline — Epic 1
 *
 * Provides automated data quality checks, stale data cleanup, and
 * deduplication for the title catalog. Designed to run as a scheduled
 * job or on-demand via `pnpm quality:check`.
 *
 * Quality checks produce a report with completeness scoring and a
 * list of actionable issues. Cleanup functions are idempotent and
 * safe for repeated execution.
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface QualityIssue {
  type: string;
  message: string;
  count: number;
}

export interface QualityReport {
  totalTitles: number;
  missingPoster: number;
  missingImdbId: number;
  missingVoteAverage: number;
  missingPopularity: number;
  duplicateNames: number;
  staleAvailability: number;
  completenessScore: number;
  issues: QualityIssue[];
}

// ============================================================================
// Quality Checks
// ============================================================================

export async function runQualityChecks(prisma: PrismaClient): Promise<QualityReport> {
  const totalTitles = await prisma.title.count();
  const issues: QualityIssue[] = [];

  const missingPoster = await prisma.title.count({ where: { posterUrl: null } });
  const missingImdbId = await prisma.title.count({ where: { imdbId: null } });
  const missingVoteAverage = await prisma.title.count({ where: { voteAverage: null } });
  const missingPopularity = await prisma.title.count({ where: { popularity: null } });

  if (missingPoster > 0) {
    issues.push({
      type: 'missing_poster',
      message: 'Titles without poster image',
      count: missingPoster,
    });
  }
  if (missingImdbId > 0) {
    issues.push({
      type: 'missing_imdb_id',
      message: 'Titles without IMDB ID',
      count: missingImdbId,
    });
  }
  if (missingVoteAverage > 0) {
    issues.push({
      type: 'missing_vote_average',
      message: 'Titles without vote average',
      count: missingVoteAverage,
    });
  }
  if (missingPopularity > 0) {
    issues.push({
      type: 'missing_popularity',
      message: 'Titles without popularity score',
      count: missingPopularity,
    });
  }

  // Duplicate names
  const dupes: { count: bigint }[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM (
      SELECT "name" FROM "Title" GROUP BY "name" HAVING COUNT(*) > 1
    ) AS dups
  `;
  const duplicateNames = Number(dupes[0]?.count ?? 0);
  if (duplicateNames > 0) {
    issues.push({
      type: 'duplicate_names',
      message: 'Titles with duplicate names',
      count: duplicateNames,
    });
  }

  // Stale availability (>30 days since lastSeenAt)
  const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const staleAvailability = await prisma.availability.count({
    where: {
      OR: [{ lastSeenAt: { lt: staleThreshold } }, { lastSeenAt: null }],
    },
  });
  if (staleAvailability > 0) {
    issues.push({
      type: 'stale_availability',
      message: 'Availability records older than 30 days',
      count: staleAvailability,
    });
  }

  // Completeness score: percentage of titles with all key fields populated
  const completeCount = await prisma.title.count({
    where: {
      posterUrl: { not: null },
      imdbId: { not: null },
      voteAverage: { not: null },
      popularity: { not: null },
    },
  });
  const completenessScore = totalTitles > 0 ? Math.round((completeCount / totalTitles) * 100) : 100;

  return {
    totalTitles,
    missingPoster,
    missingImdbId,
    missingVoteAverage,
    missingPopularity,
    duplicateNames,
    staleAvailability,
    completenessScore,
    issues,
  };
}

// ============================================================================
// Cleanup Functions
// ============================================================================

export async function cleanStaleAvailability(
  prisma: PrismaClient,
  maxAgeDays = 30,
): Promise<number> {
  const threshold = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const result = await prisma.availability.deleteMany({
    where: {
      OR: [{ lastSeenAt: { lt: threshold } }, { lastSeenAt: null }],
    },
  });
  return result.count;
}

export async function deduplicateAvailability(prisma: PrismaClient): Promise<number> {
  // Find duplicates by composite key, keeping the one with the most recent lastSeenAt
  const dupes: {
    titleId: string;
    service: string;
    region: string;
    offerType: string;
    cnt: bigint;
  }[] = await prisma.$queryRaw`
      SELECT "titleId", "service", "region", "offerType", COUNT(*) as cnt
      FROM "Availability"
      GROUP BY "titleId", "service", "region", "offerType"
      HAVING COUNT(*) > 1
    `;

  let removed = 0;
  for (const d of dupes) {
    // Keep the row with the newest lastSeenAt (or newest id as tiebreak)
    const rows = await prisma.availability.findMany({
      where: {
        titleId: d.titleId,
        service: d.service,
        region: d.region,
        offerType: d.offerType,
      },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
    });
    const idsToDelete = rows.slice(1).map((r) => r.id);
    if (idsToDelete.length > 0) {
      const result = await prisma.availability.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      removed += result.count;
    }
  }
  return removed;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/* c8 ignore start */
if (require.main === module || process.argv[1]?.endsWith('dataQuality.ts')) {
  const prisma = new PrismaClient();
  runQualityChecks(prisma)
    .then((report) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.completenessScore >= 50 ? 0 : 1);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
/* c8 ignore stop */
