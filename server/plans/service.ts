/**
 * Plan Service — Epic 9: Monetization & Growth
 *
 * Manages freemium plan lifecycle: tier lookup, trial, subscribe, cancel.
 * Billing is mocked (DB flag flip) per acceptance criteria.
 */

import type { PrismaClient } from '@prisma/client';
import { getPlanConfig } from '../agents/config';

export interface PlanStatus {
  plan: 'free' | 'premium';
  status: 'active' | 'trial' | 'cancelled' | 'expired';
  trialEndsAt: string | null;
  subscribedAt: string | null;
  cancelledAt: string | null;
  features: string[];
}

export class PlanService {
  private db: any;
  constructor(private prisma: PrismaClient) {
    // Cast to any for new models (PlanSubscription) added in Epic 9 migration
    this.db = prisma as any;
  }

  /**
   * Returns the effective tier for a user, accounting for trial expiry.
   */
  async getEffectiveTier(userId: string): Promise<'free' | 'premium'> {
    const sub = await this.db.planSubscription.findUnique({
      where: { userId },
    });
    if (!sub) return 'free';

    if (sub.plan === 'premium' && sub.status === 'active') return 'premium';
    if (sub.status === 'trial') {
      if (sub.trialEndsAt && new Date(sub.trialEndsAt) > new Date()) {
        return 'premium';
      }
      // Trial expired — update status
      await this.db.planSubscription.update({
        where: { userId },
        data: { status: 'expired', plan: 'free' },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { tier: 'free' },
      });
      return 'free';
    }
    return 'free';
  }

  /**
   * Returns full plan status for a user.
   */
  async getPlanStatus(userId: string): Promise<PlanStatus> {
    const config = getPlanConfig();
    const sub = await this.db.planSubscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      return {
        plan: 'free',
        status: 'active',
        trialEndsAt: null,
        subscribedAt: null,
        cancelledAt: null,
        features: [],
      };
    }

    // Check trial expiry
    if (sub.status === 'trial' && sub.trialEndsAt && new Date(sub.trialEndsAt) <= new Date()) {
      await this.db.planSubscription.update({
        where: { userId },
        data: { status: 'expired', plan: 'free' },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { tier: 'free' },
      });
      return {
        plan: 'free',
        status: 'expired',
        trialEndsAt: sub.trialEndsAt.toISOString(),
        subscribedAt: null,
        cancelledAt: null,
        features: [],
      };
    }

    const effectivePlan =
      sub.plan === 'premium' && (sub.status === 'active' || sub.status === 'trial')
        ? 'premium'
        : 'free';

    return {
      plan: effectivePlan,
      status: sub.status as PlanStatus['status'],
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      subscribedAt: sub.subscribedAt?.toISOString() ?? null,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      features: effectivePlan === 'premium' ? config.premiumFeatures : [],
    };
  }

  /**
   * Start a premium trial (mocked billing).
   */
  async startTrial(userId: string): Promise<PlanStatus> {
    const config = getPlanConfig();
    const existing = await this.db.planSubscription.findUnique({
      where: { userId },
    });

    if (existing?.status === 'trial' || existing?.status === 'active') {
      return this.getPlanStatus(userId);
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + config.trialDurationDays);

    await this.db.planSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'premium',
        status: 'trial',
        trialEndsAt,
      },
      update: {
        plan: 'premium',
        status: 'trial',
        trialEndsAt,
        cancelledAt: null,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { tier: 'premium' },
    });

    return this.getPlanStatus(userId);
  }

  /**
   * Subscribe to premium (mocked billing — DB flag flip).
   */
  async subscribe(userId: string): Promise<PlanStatus> {
    const now = new Date();

    await this.db.planSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'premium',
        status: 'active',
        subscribedAt: now,
      },
      update: {
        plan: 'premium',
        status: 'active',
        subscribedAt: now,
        cancelledAt: null,
        trialEndsAt: null,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { tier: 'premium' },
    });

    return this.getPlanStatus(userId);
  }

  /**
   * Cancel subscription.
   */
  async cancel(userId: string): Promise<PlanStatus> {
    const now = new Date();

    await this.db.planSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: 'free',
        status: 'cancelled',
        cancelledAt: now,
      },
      update: {
        plan: 'free',
        status: 'cancelled',
        cancelledAt: now,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { tier: 'free' },
    });

    return this.getPlanStatus(userId);
  }

  /**
   * Check if a user has access to a specific premium feature.
   */
  async hasFeature(userId: string, feature: string): Promise<boolean> {
    const tier = await this.getEffectiveTier(userId);
    if (tier !== 'premium') return false;
    const config = getPlanConfig();
    return config.premiumFeatures.includes(feature);
  }
}
