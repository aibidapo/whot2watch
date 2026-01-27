/**
 * Affiliate Link Instrumentation — Epic 9: Monetization & Growth
 *
 * Centralized affiliate param logic extracted from server/api.ts.
 * Supports per-provider tags and premium ad-free bypass.
 */

import type { PrismaClient } from '@prisma/client';
import { PlanService } from '../plans/service';

/**
 * Per-provider affiliate tags parsed from AFFILIATE_PROVIDER_TAGS env var.
 * Expected JSON format: {"netflix":"tag123","disney_plus":"tag456"}
 */
function getProviderTags(): Record<string, string> {
  const raw = process.env.AFFILIATE_PROVIDER_TAGS;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Append affiliate UTM params to a URL.
 * @param rawUrl - The deep link URL
 * @param service - Optional streaming service name for utm_content
 */
export function appendAffiliateParams(rawUrl: string, service?: string): string {
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'whot2watch');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'affiliate');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', 'watch_now');
    if (service && !u.searchParams.has('utm_content')) u.searchParams.set('utm_content', service);

    // Per-provider affiliate tag
    const providerTags = getProviderTags();
    const serviceKey = service?.toLowerCase().replace(/\s+/g, '_');
    if (serviceKey && providerTags[serviceKey]) {
      u.searchParams.set('affiliate_tag', providerTags[serviceKey]);
    }

    return u.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Check if a user should receive ad-free (no affiliate params) links.
 * Premium users get clean URLs.
 */
export async function isAdFree(userId: string | undefined, prisma: PrismaClient): Promise<boolean> {
  if (!userId) return false;
  const planService = new PlanService(prisma);
  const tier = await planService.getEffectiveTier(userId);
  return tier === 'premium';
}

/**
 * Get disclosure text configuration.
 */
export function getDisclosureConfig(): { enabled: boolean; text: string | null } {
  const enabled = process.env.AFFILIATES_ENABLED === 'true';
  const text =
    process.env.AFFILIATE_DISCLOSURE_TEXT ||
    'Some links may earn us a commission at no extra cost to you.';
  return {
    enabled,
    text: enabled ? text : null,
  };
}
