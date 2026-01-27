import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService, LogOnlyProvider } from './service';
import type { PushProvider, NotificationPayload } from './types';

function makeMockPrisma() {
  return {
    deviceToken: {
      upsert: vi.fn().mockResolvedValue({ id: 'dt1', profileId: 'p1', token: 'tok', platform: 'WEB' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'dt1', token: 'tok123' }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 'np1', profileId: 'p1', pushEnabled: true }),
    },
    notificationLog: {
      create: vi.fn().mockResolvedValue({ id: 'nl1' }),
      count: vi.fn().mockResolvedValue(0),
    },
  } as any;
}

const mockPayload: NotificationPayload = {
  title: 'New on Netflix',
  body: 'Title X is now available',
  alertId: 'a1',
  titleId: 't1',
};

describe('NotificationService', () => {
  let prisma: ReturnType<typeof makeMockPrisma>;
  let provider: PushProvider;
  let service: NotificationService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    provider = { send: vi.fn().mockResolvedValue(true) };
    service = new NotificationService(prisma, provider);
    process.env.NOTIFICATIONS_ENABLED = 'true';
  });

  it('registers device token via upsert', async () => {
    await service.registerDeviceToken('p1', 'tok', 'WEB');
    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId_token: { profileId: 'p1', token: 'tok' } },
      }),
    );
  });

  it('sends notification via LogOnlyProvider', async () => {
    const logProvider = new LogOnlyProvider();
    const result = await logProvider.send('tok', mockPayload);
    expect(result).toBe(true);
  });

  it('suppresses when quiet hours active', () => {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const current = `${hh}:${mm}`;
    // Set quiet hours to include current time
    const startH = now.getUTCHours();
    const endH = (now.getUTCHours() + 2) % 24;
    const start = `${String(startH).padStart(2, '0')}:00`;
    const end = `${String(endH).padStart(2, '0')}:00`;
    const result = service.isWithinQuietHours({
      pushEnabled: true,
      emailEnabled: false,
      webhookEnabled: false,
      quietHoursStart: start,
      quietHoursEnd: end,
      frequencyCap: 10,
      consentGiven: true,
      consentTs: new Date(),
    });
    expect(result).toBe(true);
  });

  it('enforces frequency cap', async () => {
    prisma.notificationLog.count.mockResolvedValue(10);
    const exceeded = await service.checkFrequencyCap('p1', 10);
    expect(exceeded).toBe(true);
  });

  it('blocks send when no consent', async () => {
    // Default prefs have consentGiven=false
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    const status = await service.sendNotification('a1', 'p1', mockPayload);
    expect(status).toBe('SUPPRESSED');
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUPPRESSED', error: 'no_consent' }),
      }),
    );
  });

  it('creates log entry on successful send', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      emailEnabled: false,
      webhookEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      frequencyCap: 10,
      consentGiven: true,
      consentTs: new Date(),
    });
    prisma.notificationLog.count.mockResolvedValue(0);
    const status = await service.sendNotification('a1', 'p1', mockPayload);
    expect(status).toBe('SENT');
    expect(provider.send).toHaveBeenCalled();
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('suppresses when feature flag disabled', async () => {
    process.env.NOTIFICATIONS_ENABLED = 'false';
    const status = await service.sendNotification('a1', 'p1', mockPayload);
    expect(status).toBe('SUPPRESSED');
    expect(provider.send).not.toHaveBeenCalled();
  });
});
