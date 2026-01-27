/**
 * Data Privacy Service — Epic 1 (GDPR-aligned)
 *
 * Provides user data export (right of access), deletion (right to
 * erasure), and automated retention policy enforcement. Prisma
 * cascade-delete handles related records when a user is removed.
 *
 * Retention thresholds are configurable via environment variables
 * with sensible defaults.
 */

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface UserDataExport {
  user: {
    id: string;
    email: string;
    region: string | null;
    tier: string;
    createdAt: Date;
  };
  profiles: Array<{
    id: string;
    name: string;
    preferences: unknown;
    locale: string | null;
  }>;
  subscriptions: Array<{
    service: string;
    region: string | null;
    active: boolean;
  }>;
  lists: Array<{
    name: string;
    visibility: string;
    items: Array<{ titleId: string; note: string | null }>;
  }>;
  feedback: Array<{
    titleId: string;
    action: string;
    ts: Date;
  }>;
  alerts: Array<{
    alertType: string;
    status: string;
    region: string;
  }>;
  deviceTokens: Array<{
    token: string;
    platform: string;
  }>;
  notificationPreferences: Array<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    webhookEnabled: boolean;
    frequencyCap: number;
    consentGiven: boolean;
  }>;
}

export interface DeletionSummary {
  userId: string;
  deleted: true;
  profilesRemoved: number;
}

export interface RetentionSummary {
  feedbackPurged: number;
  alertsPurged: number;
  recommendationsPurged: number;
  trendingPurged: number;
  notificationLogsPurged: number;
}

// ============================================================================
// Configuration
// ============================================================================

function getRetentionDays(): {
  feedback: number;
  alerts: number;
  recommendations: number;
  trending: number;
  notificationLogs: number;
} {
  return {
    feedback: Number(process.env.DATA_RETENTION_FEEDBACK_DAYS || 730),
    alerts: Number(process.env.DATA_RETENTION_ALERTS_DAYS || 90),
    recommendations: Number(process.env.DATA_RETENTION_RECOMMENDATIONS_DAYS || 30),
    trending: Number(process.env.DATA_RETENTION_TRENDING_DAYS || 90),
    notificationLogs: Number(process.env.DATA_RETENTION_NOTIFICATION_LOG_DAYS || 90),
  };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ============================================================================
// Export
// ============================================================================

export async function exportUserData(
  userId: string,
  prisma: PrismaClient,
): Promise<UserDataExport | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const profiles = await prisma.profile.findMany({
    where: { userId },
    select: { id: true, name: true, preferences: true, locale: true },
  });

  const profileIds = profiles.map((p) => p.id);

  const subscriptions = await prisma.subscription.findMany({
    where: { profileId: { in: profileIds } },
    select: { service: true, region: true, active: true },
  });

  const lists = await prisma.list.findMany({
    where: { profileId: { in: profileIds } },
    select: {
      name: true,
      visibility: true,
      items: { select: { titleId: true, note: true } },
    },
  });

  const feedback = await prisma.feedback.findMany({
    where: { profileId: { in: profileIds } },
    select: { titleId: true, action: true, ts: true },
  });

  const alerts = await prisma.alert.findMany({
    where: { profileId: { in: profileIds } },
    select: { alertType: true, status: true, region: true },
  });

  const deviceTokens = await (prisma as any).deviceToken.findMany({
    where: { profileId: { in: profileIds } },
    select: { token: true, platform: true },
  });

  const notificationPreferences = await (prisma as any).notificationPreference.findMany({
    where: { profileId: { in: profileIds } },
    select: {
      pushEnabled: true,
      emailEnabled: true,
      webhookEnabled: true,
      frequencyCap: true,
      consentGiven: true,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      region: user.region,
      tier: user.tier,
      createdAt: user.createdAt,
    },
    profiles,
    subscriptions,
    lists,
    feedback,
    alerts,
    deviceTokens,
    notificationPreferences,
  };
}

// ============================================================================
// Delete
// ============================================================================

export async function deleteUserData(
  userId: string,
  prisma: PrismaClient,
): Promise<DeletionSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profiles: { select: { id: true } } },
  });
  if (!user) return null;

  const profilesRemoved = user.profiles.length;

  // Cascade-delete handles profiles, subscriptions, lists, items, feedback, alerts, etc.
  await prisma.user.delete({ where: { id: userId } });

  return { userId, deleted: true, profilesRemoved };
}

// ============================================================================
// Retention Policy
// ============================================================================

export async function enforceRetentionPolicy(prisma: PrismaClient): Promise<RetentionSummary> {
  const cfg = getRetentionDays();

  const feedbackResult = await prisma.feedback.deleteMany({
    where: { ts: { lt: daysAgo(cfg.feedback) } },
  });

  const alertsResult = await prisma.alert.deleteMany({
    where: {
      status: { in: ['FIRED', 'CANCELLED'] },
      createdAt: { lt: daysAgo(cfg.alerts) },
    },
  });

  const recommendationsResult = await prisma.recommendation.deleteMany({
    where: { createdAt: { lt: daysAgo(cfg.recommendations) } },
  });

  const trendingResult = await (prisma as any).trendingSignal.deleteMany({
    where: { ts: { lt: daysAgo(cfg.trending) } },
  });

  const notificationLogsResult = await (prisma as any).notificationLog.deleteMany({
    where: { sentAt: { lt: daysAgo(cfg.notificationLogs) } },
  });

  return {
    feedbackPurged: feedbackResult.count,
    alertsPurged: alertsResult.count,
    recommendationsPurged: recommendationsResult.count,
    trendingPurged: trendingResult.count,
    notificationLogsPurged: notificationLogsResult.count,
  };
}
