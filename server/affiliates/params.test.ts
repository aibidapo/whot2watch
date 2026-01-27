import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appendAffiliateParams, isAdFree, getDisclosureConfig } from './params';

describe('appendAffiliateParams', () => {
  beforeEach(() => {
    delete process.env.AFFILIATE_PROVIDER_TAGS;
  });

  it('appends UTM params to a URL', () => {
    const result = appendAffiliateParams('https://example.com/watch');
    expect(result).toContain('utm_source=whot2watch');
    expect(result).toContain('utm_medium=affiliate');
    expect(result).toContain('utm_campaign=watch_now');
  });

  it('appends service as utm_content', () => {
    const result = appendAffiliateParams('https://example.com/watch', 'NETFLIX');
    expect(result).toContain('utm_content=NETFLIX');
  });

  it('does not overwrite existing UTM params', () => {
    const result = appendAffiliateParams('https://example.com/watch?utm_source=existing');
    expect(result).toContain('utm_source=existing');
    expect(result).not.toContain('utm_source=whot2watch');
  });

  it('returns original URL for invalid URLs', () => {
    const result = appendAffiliateParams('not-a-url');
    expect(result).toBe('not-a-url');
  });

  it('appends per-provider affiliate tag', () => {
    process.env.AFFILIATE_PROVIDER_TAGS = JSON.stringify({
      netflix: 'aff123',
    });
    const result = appendAffiliateParams('https://example.com/watch', 'netflix');
    expect(result).toContain('affiliate_tag=aff123');
  });

  it('handles invalid AFFILIATE_PROVIDER_TAGS gracefully', () => {
    process.env.AFFILIATE_PROVIDER_TAGS = 'not-json';
    const result = appendAffiliateParams('https://example.com/watch', 'NETFLIX');
    expect(result).toContain('utm_source=whot2watch');
    expect(result).not.toContain('affiliate_tag');
  });
});

describe('isAdFree', () => {
  const mockPrisma = {
    planSubscription: {
      findUnique: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for undefined userId', async () => {
    const result = await isAdFree(undefined, mockPrisma as any);
    expect(result).toBe(false);
  });

  it('returns false for free user', async () => {
    mockPrisma.planSubscription.findUnique.mockResolvedValue(null);
    const result = await isAdFree('user-1', mockPrisma as any);
    expect(result).toBe(false);
  });

  it('returns true for premium user', async () => {
    mockPrisma.planSubscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      plan: 'premium',
      status: 'active',
      trialEndsAt: null,
    });
    const result = await isAdFree('user-1', mockPrisma as any);
    expect(result).toBe(true);
  });
});

describe('getDisclosureConfig', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns disabled when AFFILIATES_ENABLED is not set', () => {
    delete process.env.AFFILIATES_ENABLED;
    const config = getDisclosureConfig();
    expect(config.enabled).toBe(false);
    expect(config.text).toBeNull();
  });

  it('returns enabled with default text when AFFILIATES_ENABLED=true', () => {
    process.env.AFFILIATES_ENABLED = 'true';
    delete process.env.AFFILIATE_DISCLOSURE_TEXT;
    const config = getDisclosureConfig();
    expect(config.enabled).toBe(true);
    expect(config.text).toContain('commission');
  });

  it('returns custom disclosure text when configured', () => {
    process.env.AFFILIATES_ENABLED = 'true';
    process.env.AFFILIATE_DISCLOSURE_TEXT = 'Custom disclosure.';
    const config = getDisclosureConfig();
    expect(config.text).toBe('Custom disclosure.');
  });
});
