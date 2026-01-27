import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  referralCode: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  referralRedemption: {
    create: vi.fn(),
  },
};

import { ReferralService } from './service';

describe('ReferralService', () => {
  let service: ReferralService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReferralService(mockPrisma as any);
  });

  describe('generateCode', () => {
    it('returns existing code if user already has one', async () => {
      mockPrisma.referralCode.findFirst.mockResolvedValue({
        code: 'ABC123',
        userId: 'user-1',
        maxUses: 10,
        redemptions: [{ id: 'r1' }, { id: 'r2' }],
      });

      const result = await service.generateCode('user-1');
      expect(result.code).toBe('ABC123');
      expect(result.redemptions).toBe(2);
      expect(mockPrisma.referralCode.create).not.toHaveBeenCalled();
    });

    it('creates a new 6-char code', async () => {
      mockPrisma.referralCode.findFirst.mockResolvedValue(null);
      mockPrisma.referralCode.findUnique.mockResolvedValue(null);
      mockPrisma.referralCode.create.mockResolvedValue({
        code: 'XYZ789',
        userId: 'user-1',
        maxUses: 10,
      });

      const result = await service.generateCode('user-1');
      expect(result.code).toHaveLength(6);
      expect(result.maxUses).toBe(10);
      expect(result.redemptions).toBe(0);
    });
  });

  describe('redeemCode', () => {
    it('returns error for invalid code', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue(null);

      const result = await service.redeemCode('BADCODE', 'user-2');
      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_CODE');
    });

    it('prevents self-referral', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'rc-1',
        code: 'ABC123',
        userId: 'user-1',
        maxUses: 10,
        redemptions: [],
      });

      const result = await service.redeemCode('ABC123', 'user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('SELF_REFERRAL');
    });

    it('prevents double redemption', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'rc-1',
        code: 'ABC123',
        userId: 'user-1',
        maxUses: 10,
        redemptions: [{ id: 'r1', redeemedByUserId: 'user-2' }],
      });

      const result = await service.redeemCode('ABC123', 'user-2');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ALREADY_REDEEMED');
    });

    it('prevents exceeding max uses', async () => {
      const redemptions = Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        redeemedByUserId: `user-${i + 10}`,
      }));
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'rc-1',
        code: 'ABC123',
        userId: 'user-1',
        maxUses: 10,
        redemptions,
      });

      const result = await service.redeemCode('ABC123', 'user-99');
      expect(result.success).toBe(false);
      expect(result.error).toBe('MAX_USES_REACHED');
    });

    it('successfully redeems a valid code', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'rc-1',
        code: 'ABC123',
        userId: 'user-1',
        maxUses: 10,
        redemptions: [],
      });
      mockPrisma.referralRedemption.create.mockResolvedValue({
        id: 'rr-1',
      });

      const result = await service.redeemCode('ABC123', 'user-2');
      expect(result.success).toBe(true);
      expect(mockPrisma.referralRedemption.create).toHaveBeenCalledWith({
        data: {
          referralCodeId: 'rc-1',
          redeemedByUserId: 'user-2',
        },
      });
    });
  });

  describe('getStats', () => {
    it('returns empty stats when no referral code exists', async () => {
      mockPrisma.referralCode.findFirst.mockResolvedValue(null);

      const stats = await service.getStats('user-1');
      expect(stats.code).toBeNull();
      expect(stats.totalReferred).toBe(0);
    });

    it('returns correct stats', async () => {
      mockPrisma.referralCode.findFirst.mockResolvedValue({
        code: 'ABC123',
        redemptions: [
          { id: 'r1', redeemedByUserId: 'user-2' },
          { id: 'r2', redeemedByUserId: 'user-3' },
        ],
      });

      const stats = await service.getStats('user-1');
      expect(stats.code).toBe('ABC123');
      expect(stats.totalReferred).toBe(2);
      expect(stats.activeReferred).toBe(2);
    });
  });
});
