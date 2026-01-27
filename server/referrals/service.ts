/**
 * Referral Service — Epic 9: Monetization & Growth
 *
 * Manages referral code generation, redemption, and stats.
 * Anti-abuse: can't redeem own code, can't redeem twice, max uses cap.
 */

import type { PrismaClient } from "@prisma/client";

export interface ReferralStats {
  code: string | null;
  totalReferred: number;
  activeReferred: number;
}

/**
 * Generate a random 6-character alphanumeric code.
 */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class ReferralService {
  private db: any;
  constructor(private prisma: PrismaClient) {
    // Cast to any for new models (ReferralCode, ReferralRedemption) added in Epic 9 migration
    this.db = prisma as any;
  }

  /**
   * Generate or return existing referral code for a user.
   * Idempotent: returns existing code if already generated.
   */
  async generateCode(
    userId: string,
  ): Promise<{ code: string; userId: string; maxUses: number; redemptions: number }> {
    // Check for existing code
    const existing = await this.db.referralCode.findFirst({
      where: { userId },
      include: { redemptions: true },
    });

    if (existing) {
      return {
        code: existing.code,
        userId: existing.userId,
        maxUses: existing.maxUses,
        redemptions: existing.redemptions.length,
      };
    }

    // Generate unique code with retry
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const conflict = await this.db.referralCode.findUnique({
        where: { code },
      });
      if (!conflict) break;
      code = generateCode();
      attempts++;
    }

    const created = await this.db.referralCode.create({
      data: {
        code,
        userId,
        maxUses: 10,
      },
    });

    return {
      code: created.code,
      userId: created.userId,
      maxUses: created.maxUses,
      redemptions: 0,
    };
  }

  /**
   * Redeem a referral code.
   * Anti-abuse checks:
   * - Can't redeem own code
   * - Can't redeem twice
   * - Max uses cap
   */
  async redeemCode(
    code: string,
    redeemedByUserId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const referralCode = await this.db.referralCode.findUnique({
      where: { code },
      include: { redemptions: true },
    });

    if (!referralCode) {
      return { success: false, error: "INVALID_CODE" };
    }

    // Can't redeem own code
    if (referralCode.userId === redeemedByUserId) {
      return { success: false, error: "SELF_REFERRAL" };
    }

    // Can't redeem twice
    const alreadyRedeemed = referralCode.redemptions.some(
      (r: any) => r.redeemedByUserId === redeemedByUserId,
    );
    if (alreadyRedeemed) {
      return { success: false, error: "ALREADY_REDEEMED" };
    }

    // Max uses cap
    if (referralCode.redemptions.length >= referralCode.maxUses) {
      return { success: false, error: "MAX_USES_REACHED" };
    }

    await this.db.referralRedemption.create({
      data: {
        referralCodeId: referralCode.id,
        redeemedByUserId,
      },
    });

    return { success: true };
  }

  /**
   * Get referral stats for a user.
   */
  async getStats(userId: string): Promise<ReferralStats> {
    const referralCode = await this.db.referralCode.findFirst({
      where: { userId },
      include: { redemptions: true },
    });

    if (!referralCode) {
      return { code: null, totalReferred: 0, activeReferred: 0 };
    }

    return {
      code: referralCode.code,
      totalReferred: referralCode.redemptions.length,
      activeReferred: referralCode.redemptions.length, // all redeemers counted as active
    };
  }
}
