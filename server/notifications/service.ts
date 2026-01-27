/**
 * Notification Service — Epic 5
 *
 * Abstract push provider with graceful degradation. Checks preferences,
 * quiet hours, frequency caps, and consent before dispatching.
 */

import type { PrismaClient } from '@prisma/client';
import { logger } from '../common/logger';
import type { NotificationPayload, PushProvider, NotificationChannel, NotificationStatus } from './types';

// ============================================================================
// Push Providers
// ============================================================================

export class LogOnlyProvider implements PushProvider {
  async send(token: string, payload: NotificationPayload): Promise<boolean> {
    logger.info('notification_log_only', { token: token.slice(0, 8) + '...', alertId: payload.alertId });
    return true;
  }
}

export class FcmProvider implements PushProvider {
  private serverKey: string;

  constructor(serverKey: string) {
    this.serverKey = serverKey;
  }

  async send(token: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${this.serverKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: { title: payload.title, body: payload.body },
          data: { alertId: payload.alertId, titleId: payload.titleId, deepLink: payload.deepLink },
        }),
      });
      return res.ok;
    } catch (err) {
      logger.warn('fcm_send_failed', { err: String(err) });
      return false;
    }
  }
}

export function createPushProvider(): PushProvider {
  const fcmKey = process.env.FCM_SERVER_KEY;
  if (fcmKey) return new FcmProvider(fcmKey);
  return new LogOnlyProvider();
}

// ============================================================================
// Notification Service
// ============================================================================

function isNotificationsEnabled(): boolean {
  return process.env.NOTIFICATIONS_ENABLED !== 'false';
}

export interface NotificationPreferenceDefaults {
  pushEnabled: boolean;
  emailEnabled: boolean;
  webhookEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  frequencyCap: number;
  consentGiven: boolean;
  consentTs: Date | null;
}

const DEFAULT_PREFS: NotificationPreferenceDefaults = {
  pushEnabled: true,
  emailEnabled: false,
  webhookEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  frequencyCap: Number(process.env.NOTIFICATION_FREQUENCY_CAP || 10),
  consentGiven: false,
  consentTs: null,
};

export class NotificationService {
  private prisma: PrismaClient;
  private provider: PushProvider;

  constructor(prisma: PrismaClient, provider?: PushProvider) {
    this.prisma = prisma;
    this.provider = provider ?? createPushProvider();
  }

  async registerDeviceToken(profileId: string, token: string, platform: string) {
    return (this.prisma as any).deviceToken.upsert({
      where: { profileId_token: { profileId, token } },
      update: { platform, updatedAt: new Date() },
      create: { profileId, token, platform, updatedAt: new Date() },
    });
  }

  async removeDeviceToken(profileId: string, token: string) {
    try {
      await (this.prisma as any).deviceToken.deleteMany({
        where: { profileId, token },
      });
    } catch {
      // Token may already be gone
    }
  }

  async sendNotification(
    alertId: string,
    profileId: string,
    payload: NotificationPayload,
  ): Promise<NotificationStatus> {
    if (!isNotificationsEnabled()) {
      return 'SUPPRESSED';
    }

    const prefs = await this.getPreferences(profileId);

    if (!prefs.consentGiven) {
      await this.logNotification(alertId, profileId, 'PUSH', 'SUPPRESSED', 'no_consent');
      return 'SUPPRESSED';
    }

    if (!prefs.pushEnabled) {
      await this.logNotification(alertId, profileId, 'PUSH', 'SUPPRESSED', 'push_disabled');
      return 'SUPPRESSED';
    }

    if (this.isWithinQuietHours(prefs)) {
      await this.logNotification(alertId, profileId, 'PUSH', 'SUPPRESSED', 'quiet_hours');
      return 'SUPPRESSED';
    }

    const capExceeded = await this.checkFrequencyCap(profileId, prefs.frequencyCap);
    if (capExceeded) {
      await this.logNotification(alertId, profileId, 'PUSH', 'SUPPRESSED', 'frequency_cap');
      return 'SUPPRESSED';
    }

    // Send to all registered device tokens
    const tokens = await (this.prisma as any).deviceToken.findMany({
      where: { profileId },
    });

    let sent = false;
    for (const dt of tokens) {
      const ok = await this.provider.send(dt.token, payload);
      if (ok) sent = true;
    }

    const status: NotificationStatus = sent || tokens.length === 0 ? 'SENT' : 'FAILED';
    await this.logNotification(alertId, profileId, 'PUSH', status);
    return status;
  }

  isWithinQuietHours(prefs: NotificationPreferenceDefaults): boolean {
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;
    const now = new Date();
    const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const start = prefs.quietHoursStart;
    const end = prefs.quietHoursEnd;
    if (start <= end) {
      return hhmm >= start && hhmm < end;
    }
    // Wraps midnight (e.g. 22:00 → 06:00)
    return hhmm >= start || hhmm < end;
  }

  async checkFrequencyCap(profileId: string, cap: number): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const count = await (this.prisma as any).notificationLog.count({
      where: {
        profileId,
        status: 'SENT',
        sentAt: { gte: startOfDay },
      },
    });
    return count >= cap;
  }

  async getPreferences(profileId: string): Promise<NotificationPreferenceDefaults> {
    const pref = await (this.prisma as any).notificationPreference.findUnique({
      where: { profileId },
    });
    if (!pref) return { ...DEFAULT_PREFS };
    return {
      pushEnabled: pref.pushEnabled,
      emailEnabled: pref.emailEnabled,
      webhookEnabled: pref.webhookEnabled,
      quietHoursStart: pref.quietHoursStart,
      quietHoursEnd: pref.quietHoursEnd,
      frequencyCap: pref.frequencyCap,
      consentGiven: pref.consentGiven,
      consentTs: pref.consentTs,
    };
  }

  async upsertPreferences(profileId: string, input: Partial<NotificationPreferenceDefaults>) {
    const data: any = { ...input };
    if (input.consentGiven === true) {
      data.consentTs = new Date();
    }
    data.updatedAt = new Date();
    return (this.prisma as any).notificationPreference.upsert({
      where: { profileId },
      update: data,
      create: { profileId, ...data },
    });
  }

  private async logNotification(
    alertId: string,
    profileId: string,
    channel: NotificationChannel,
    status: NotificationStatus,
    error?: string,
  ) {
    try {
      await (this.prisma as any).notificationLog.create({
        data: { alertId, profileId, channel, status, error: error ?? null },
      });
    } catch (err) {
      logger.warn('notification_log_failed', { err: String(err) });
    }
  }
}
