import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
const mockPrisma = {
  planSubscription: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

import { PlanService } from './service';
import type { PlanStatus } from './service';

describe('PlanService', () => {
  let service: PlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlanService(mockPrisma as any);
  });

  describe('getEffectiveTier', () => {
    it('returns "free" when no subscription exists', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue(null);
      const tier = await service.getEffectiveTier('user-1');
      expect(tier).toBe('free');
    });

    it('returns "premium" for active premium subscription', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'active',
        trialEndsAt: null,
      });
      const tier = await service.getEffectiveTier('user-1');
      expect(tier).toBe('premium');
    });

    it('returns "premium" for active trial within expiry', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'trial',
        trialEndsAt: future,
      });
      const tier = await service.getEffectiveTier('user-1');
      expect(tier).toBe('premium');
    });

    it('returns "free" for expired trial and updates DB', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'trial',
        trialEndsAt: past,
      });
      mockPrisma.planSubscription.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const tier = await service.getEffectiveTier('user-1');
      expect(tier).toBe('free');
      expect(mockPrisma.planSubscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { status: 'expired', plan: 'free' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tier: 'free' },
      });
    });

    it('returns "free" for cancelled subscription', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'free',
        status: 'cancelled',
        trialEndsAt: null,
      });
      const tier = await service.getEffectiveTier('user-1');
      expect(tier).toBe('free');
    });
  });

  describe('getPlanStatus', () => {
    it('returns free status with empty features when no subscription', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue(null);
      const status = await service.getPlanStatus('user-1');
      expect(status.plan).toBe('free');
      expect(status.status).toBe('active');
      expect(status.features).toEqual([]);
    });

    it('returns premium features for active subscription', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'active',
        trialEndsAt: null,
        subscribedAt: new Date('2025-01-01'),
        cancelledAt: null,
      });
      const status = await service.getPlanStatus('user-1');
      expect(status.plan).toBe('premium');
      expect(status.features.length).toBeGreaterThan(0);
      expect(status.features).toContain('advanced_filters');
    });
  });

  describe('startTrial', () => {
    it('creates a trial subscription', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.planSubscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      // After upsert, getPlanStatus is called
      mockPrisma.planSubscription.findUnique
        .mockResolvedValueOnce(null) // first call in startTrial
        .mockResolvedValueOnce({
          userId: 'user-1',
          plan: 'premium',
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 86400000),
          subscribedAt: null,
          cancelledAt: null,
        });

      const status = await service.startTrial('user-1');
      expect(status.plan).toBe('premium');
      expect(status.status).toBe('trial');
      expect(status.trialEndsAt).toBeTruthy();
      expect(mockPrisma.planSubscription.upsert).toHaveBeenCalled();
    });

    it('returns existing status if already on trial', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      const existing = {
        userId: 'user-1',
        plan: 'premium',
        status: 'trial',
        trialEndsAt: future,
        subscribedAt: null,
        cancelledAt: null,
      };
      mockPrisma.planSubscription.findUnique.mockResolvedValue(existing);

      const status = await service.startTrial('user-1');
      expect(status.plan).toBe('premium');
      expect(status.status).toBe('trial');
      expect(mockPrisma.planSubscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('upgrades to premium', async () => {
      mockPrisma.planSubscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'active',
        trialEndsAt: null,
        subscribedAt: new Date(),
        cancelledAt: null,
      });

      const status = await service.subscribe('user-1');
      expect(status.plan).toBe('premium');
      expect(status.status).toBe('active');
    });
  });

  describe('cancel', () => {
    it('cancels subscription', async () => {
      mockPrisma.planSubscription.upsert.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'free',
        status: 'cancelled',
        trialEndsAt: null,
        subscribedAt: null,
        cancelledAt: new Date(),
      });

      const status = await service.cancel('user-1');
      expect(status.plan).toBe('free');
      expect(status.status).toBe('cancelled');
    });
  });

  describe('hasFeature', () => {
    it('returns true for premium user with valid feature', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'active',
        trialEndsAt: null,
      });
      const result = await service.hasFeature('user-1', 'advanced_filters');
      expect(result).toBe(true);
    });

    it('returns false for free user', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue(null);
      const result = await service.hasFeature('user-1', 'advanced_filters');
      expect(result).toBe(false);
    });

    it('returns false for invalid feature', async () => {
      mockPrisma.planSubscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        plan: 'premium',
        status: 'active',
        trialEndsAt: null,
      });
      const result = await service.hasFeature('user-1', 'nonexistent_feature');
      expect(result).toBe(false);
    });
  });
});
