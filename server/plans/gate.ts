/**
 * Premium Gate — Epic 9: Monetization & Growth
 *
 * Reusable Fastify pre-handler that enforces premium access.
 * Returns 403 PREMIUM_REQUIRED when a free user tries to access
 * a gated feature while PLAN_ENFORCEMENT_ENABLED is true.
 * No-op when the flag is off.
 */

import type { PrismaClient } from '@prisma/client';
import { isPlanEnforcementEnabled } from '../agents/config';
import { PlanService } from './service';

/**
 * Creates a Fastify preHandler that gates access to a premium feature.
 * @param feature - The premium feature name (e.g. "advanced_filters")
 * @param prisma - Prisma client instance
 */
export function premiumGate(feature: string, prisma: PrismaClient) {
  const planService = new PlanService(prisma);

  return async function premiumGateHandler(request: any, reply: any) {
    if (!isPlanEnforcementEnabled()) return;

    // Resolve userId from request context
    const userId = resolveUserId(request);
    if (!userId) {
      reply.code(403).send({
        error: 'PREMIUM_REQUIRED',
        message: `The feature "${feature}" requires a premium subscription.`,
        upgradeUrl: '/upgrade',
      });
      return;
    }

    const hasAccess = await planService.hasFeature(userId, feature);
    if (!hasAccess) {
      reply.code(403).send({
        error: 'PREMIUM_REQUIRED',
        message: `The feature "${feature}" requires a premium subscription.`,
        upgradeUrl: '/upgrade',
      });
      return;
    }
  };
}

/**
 * Resolve userId from the request.
 * Checks x-user-id header, query param, or body.
 */
function resolveUserId(request: any): string | undefined {
  // Header-based (set by auth middleware or gateway)
  const headerUserId = request.headers?.['x-user-id'];
  if (headerUserId) return String(headerUserId);

  // Query param
  const queryUserId = (request.query as any)?.userId;
  if (queryUserId) return String(queryUserId);

  // Body
  const bodyUserId = (request.body as any)?.userId;
  if (bodyUserId) return String(bodyUserId);

  return undefined;
}
