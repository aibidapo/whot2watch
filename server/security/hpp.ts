/**
 * HTTP Parameter Pollution (HPP) protection for Fastify.
 *
 * When a query parameter appears multiple times (e.g. ?sort=name&sort=date),
 * Fastify parses it as an array. This hook collapses arrays to the last value,
 * preventing HPP attacks that exploit parameter duplication.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export function hppHook(
  req: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const q = req.query;
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    for (const key of Object.keys(q)) {
      const val = (q as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        (q as Record<string, unknown>)[key] = val[val.length - 1];
      }
    }
  }
  done();
}
