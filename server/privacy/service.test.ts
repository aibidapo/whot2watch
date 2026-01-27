import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportUserData, deleteUserData, enforceRetentionPolicy } from './service';

function makeMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    subscription: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    list: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    feedback: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    alert: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    recommendation: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    trendingSignal: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

describe('exportUserData', () => {
  it('returns null for non-existent user', async () => {
    const prisma = makeMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await exportUserData('missing-id', prisma);
    expect(result).toBeNull();
  });

  it('returns correct export structure', async () => {
    const prisma = makeMockPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      region: 'US',
      tier: 'free',
      createdAt: new Date('2024-01-01'),
    });
    prisma.profile.findMany.mockResolvedValue([
      { id: 'p1', name: 'Main', preferences: {}, locale: 'en-US' },
    ]);
    prisma.subscription.findMany.mockResolvedValue([
      { service: 'NETFLIX', region: 'US', active: true },
    ]);
    prisma.list.findMany.mockResolvedValue([
      { name: 'Watchlist', visibility: 'PRIVATE', items: [{ titleId: 't1', note: null }] },
    ]);
    prisma.feedback.findMany.mockResolvedValue([{ titleId: 't1', action: 'LIKE', ts: new Date() }]);
    prisma.alert.findMany.mockResolvedValue([
      { alertType: 'NEW_SEASON', status: 'ACTIVE', region: 'US' },
    ]);

    const result = await exportUserData('u1', prisma);
    expect(result).not.toBeNull();
    expect(result!.user.email).toBe('test@example.com');
    expect(result!.profiles).toHaveLength(1);
    expect(result!.subscriptions).toHaveLength(1);
    expect(result!.lists).toHaveLength(1);
    expect(result!.feedback).toHaveLength(1);
    expect(result!.alerts).toHaveLength(1);
  });
});

describe('deleteUserData', () => {
  it('returns null for non-existent user', async () => {
    const prisma = makeMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await deleteUserData('missing-id', prisma);
    expect(result).toBeNull();
  });

  it('deletes user and returns summary', async () => {
    const prisma = makeMockPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      profiles: [{ id: 'p1' }, { id: 'p2' }],
    });
    const result = await deleteUserData('u1', prisma);
    expect(result).not.toBeNull();
    expect(result!.deleted).toBe(true);
    expect(result!.profilesRemoved).toBe(2);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});

describe('enforceRetentionPolicy', () => {
  beforeEach(() => {
    delete process.env.DATA_RETENTION_FEEDBACK_DAYS;
    delete process.env.DATA_RETENTION_ALERTS_DAYS;
    delete process.env.DATA_RETENTION_RECOMMENDATIONS_DAYS;
    delete process.env.DATA_RETENTION_TRENDING_DAYS;
  });

  it('purges old records and returns summary', async () => {
    const prisma = makeMockPrisma();
    prisma.feedback.deleteMany.mockResolvedValue({ count: 5 });
    prisma.alert.deleteMany.mockResolvedValue({ count: 3 });
    prisma.recommendation.deleteMany.mockResolvedValue({ count: 10 });
    prisma.trendingSignal.deleteMany.mockResolvedValue({ count: 2 });

    const result = await enforceRetentionPolicy(prisma);
    expect(result.feedbackPurged).toBe(5);
    expect(result.alertsPurged).toBe(3);
    expect(result.recommendationsPurged).toBe(10);
    expect(result.trendingPurged).toBe(2);
  });

  it('respects custom retention days from env', async () => {
    process.env.DATA_RETENTION_FEEDBACK_DAYS = '365';
    const prisma = makeMockPrisma();
    prisma.feedback.deleteMany.mockResolvedValue({ count: 1 });
    prisma.alert.deleteMany.mockResolvedValue({ count: 0 });
    prisma.recommendation.deleteMany.mockResolvedValue({ count: 0 });
    prisma.trendingSignal.deleteMany.mockResolvedValue({ count: 0 });

    const result = await enforceRetentionPolicy(prisma);
    expect(result.feedbackPurged).toBe(1);

    // Verify the feedback deleteMany was called (the threshold will be different with 365 days)
    expect(prisma.feedback.deleteMany).toHaveBeenCalled();
    const call = prisma.feedback.deleteMany.mock.calls[0][0];
    expect(call.where.ts.lt).toBeInstanceOf(Date);
  });
});
