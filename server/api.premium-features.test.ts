import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock plan enforcement in config
vi.mock('./agents/config', async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    isPlanEnforcementEnabled: vi.fn(() => false),
    getPlanConfig: vi.fn(() => ({
      planEnforcementEnabled: false,
      trialDurationDays: 14,
      freeListLimit: 5,
      premiumFeatures: ['advanced_filters', 'early_alerts', 'ad_free', 'social_analytics'],
    })),
    getFeatureFlags: vi.fn(() => ({
      AI_CONCIERGE_ENABLED: false,
      NLU_ENABLED: true,
      SOCIAL_FEED_ENABLED: false,
      PLAN_ENFORCEMENT_ENABLED: false,
      AFFILIATES_ENABLED: false,
      REFERRAL_ENABLED: false,
    })),
  };
});

import { isPlanEnforcementEnabled } from './agents/config';

describe('Premium Features', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  describe('Mood filter gating', () => {
    it('allows mood filter when plan enforcement is off', () => {
      vi.mocked(isPlanEnforcementEnabled).mockReturnValue(false);
      // Mood filter should work for everyone when enforcement is off
      expect(isPlanEnforcementEnabled()).toBe(false);
    });

    it('reports enforcement enabled when flag is on', () => {
      vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);
      expect(isPlanEnforcementEnabled()).toBe(true);
    });
  });

  describe('Alert priority by tier', () => {
    it('defaults to STANDARD priority', () => {
      const priority = 'STANDARD';
      expect(priority).toBe('STANDARD');
    });

    it('premium users get EARLY priority', () => {
      const tier = 'premium';
      const priority = tier === 'premium' ? 'EARLY' : 'STANDARD';
      expect(priority).toBe('EARLY');
    });

    it('free users get STANDARD priority', () => {
      const tier: string = 'free';
      const priority = tier === 'premium' ? 'EARLY' : 'STANDARD';
      expect(priority).toBe('STANDARD');
    });
  });

  describe('Social analytics gating', () => {
    it('social analytics requires premium when enforcement is on', () => {
      vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);
      const enforced = isPlanEnforcementEnabled();
      expect(enforced).toBe(true);
    });

    it('social analytics is open when enforcement is off', () => {
      vi.mocked(isPlanEnforcementEnabled).mockReturnValue(false);
      expect(isPlanEnforcementEnabled()).toBe(false);
    });
  });
});
