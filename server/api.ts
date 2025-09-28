import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { withRequestId } from './common/requestId';
import { logger } from './common/logger';
import { normalizeDeepLink } from '../services/catalog/deeplink';

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200';
const PORT = Number(process.env.PORT || 4000);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const prisma = new PrismaClient();

function arr(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return (v as string[]).filter(Boolean);
  const s = String(v);
  if (s.includes(','))
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  return [s];
}

const app = Fastify({ logger: false });
app.register(cors, { origin: true });
app.register(helmet, { contentSecurityPolicy: false });
app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// request-id middleware
app.addHook('onRequest', (req, reply, done) => {
  withRequestId(req.raw as any, reply.raw as any, () => {});
  done();
});

// Ensure Retry-After header is present on 429 responses
app.addHook('onSend', (request, reply, payload, done) => {
  try {
    if (reply.statusCode === 429 && !reply.hasHeader('Retry-After')) {
      reply.header('Retry-After', '60');
    }
  } catch {}
  done();
});

// Optional auth pre-handler (enabled if REQUIRE_AUTH=true)
function isAuthRequired(): boolean {
  return process.env.REQUIRE_AUTH === 'true';
}
const JWT_ISSUER = process.env.JWT_ISSUER || '';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || '';
const JWKS_URI = process.env.JWKS_URI || '';

async function authPreHandler(request: any, reply: any) {
  if (!isAuthRequired()) return;
  try {
    // Lazy import to avoid loading heavy crypto deps in test bundle unless needed
    const { verifyJwt } = await import('./security/jwt');
    const h = String(request.headers?.authorization || '');
    if (!h.toLowerCase().startsWith('bearer ')) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    const token = h.slice(7).trim();
    await verifyJwt(token, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, jwksUri: JWKS_URI });
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

app.get(
  '/healthz',
  {
    schema: {
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      },
    },
  },
  async () => ({ ok: true }),
);

app.get('/', async (_request, reply) => {
  const htmlPath = path.resolve(process.cwd(), 'server', 'test-ui.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  reply.type('text/html').send(html);
});

app.get(
  '/profiles',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          required: ['items'],
        },
      },
    },
  },
  async () => {
    const rows = await prisma.profile.findMany({ select: { id: true, name: true, userId: true } });
    return { items: rows };
  },
);

app.get(
  '/search',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          size: { type: 'integer' },
          from: { type: 'integer' },
          service: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          region: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          type: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          yearMin: { type: 'integer' },
          yearMax: { type: 'integer' },
          runtimeMin: { type: 'integer' },
          runtimeMax: { type: 'integer' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
            total: { type: 'integer' },
            took: { type: 'integer' },
            from: { type: 'integer' },
            size: { type: 'integer' },
          },
          required: ['items', 'total', 'from', 'size'],
        },
      },
    },
  },
  async (request, reply) => {
    const parsed = url.parse(request.raw.url || '', true);
    const q = (parsed.query.q as string) || '';
    const sizeRaw = Number(parsed.query.size ?? 20);
    const fromRaw = Number(parsed.query.from ?? 0);
    const size = Number.isFinite(sizeRaw) ? Math.min(Math.max(sizeRaw, 1), 100) : 20;
    const from = Number.isFinite(fromRaw) ? Math.max(fromRaw, 0) : 0;
    const services = arr(parsed.query.service);
    const regions = arr(parsed.query.region);
    const types = arr(parsed.query.type);
    const yearMin = parsed.query.yearMin !== undefined ? Number(parsed.query.yearMin) : undefined;
    const yearMax = parsed.query.yearMax !== undefined ? Number(parsed.query.yearMax) : undefined;
    const runtimeMin =
      parsed.query.runtimeMin !== undefined ? Number(parsed.query.runtimeMin) : undefined;
    const runtimeMax =
      parsed.query.runtimeMax !== undefined ? Number(parsed.query.runtimeMax) : undefined;
    if (
      [yearMin, yearMax, runtimeMin, runtimeMax].some(
        (n) => n !== undefined && !Number.isFinite(n as number),
      )
    ) {
      return { items: [], total: 0, took: 0, from, size };
    }

    const filter: any[] = [];
    if (services && services.length) filter.push({ terms: { availabilityServices: services } });
    if (regions && regions.length) filter.push({ terms: { availabilityRegions: regions } });
    if (types && types.length) filter.push({ terms: { type: types } });
    if (yearMin !== undefined || yearMax !== undefined)
      filter.push({ range: { releaseYear: { gte: yearMin, lte: yearMax } } });
    if (runtimeMin !== undefined || runtimeMax !== undefined)
      filter.push({ range: { runtimeMin: { gte: runtimeMin, lte: runtimeMax } } });
    const query = {
      track_total_hits: true,
      query: {
        bool: {
          must: q ? [{ match: { name: q } }] : [{ match_all: {} }],
          filter,
          should: [{ exists: { field: 'posterUrl' } }, { exists: { field: 'backdropUrl' } }],
          minimum_should_match: 0,
        },
      },
      size,
      from,
      sort: q ? undefined : [{ _score: { order: 'desc' } }, { releaseYear: { order: 'desc' } }],
    } as any;
    // try cache first
    const cacheKey = `search:${JSON.stringify({ q, size, from, services, regions, types, yearMin, yearMax, runtimeMin, runtimeMax })}`;
    try {
      const cached = await app.redis?.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    let data: any;
    try {
      const osRes = await fetch(`${OPENSEARCH_URL}/titles/_search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
      });
      if (!osRes.ok) {
        const text = await osRes.text();
        logger.error('OpenSearch error', { status: osRes.status, text });
        return { items: [], total: 0, took: 0, from, size };
      }
      data = await osRes.json();
    } catch (err) {
      logger.warn('OpenSearch unreachable, returning empty search result', { err: String(err) });
      return { items: [], total: 0, took: 0, from, size };
    }
    const hits = (data.hits?.hits || []).map((h: any) => ({
      id: h._id,
      score: h._score,
      ...h._source,
    }));
    const total = typeof data.hits?.total?.value === 'number' ? data.hits.total.value : hits.length;
    const response = { items: hits, total, took: data.took ?? 0, from, size };
    try {
      reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    } catch {}
    try {
      await app.redis?.setEx(cacheKey, 60, JSON.stringify(response));
    } catch {}
    return response;
  },
);

// ---- Lists ----
app.get(
  '/profiles/:profileId/lists',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          required: ['items'],
        },
      },
    },
  },
  async (request) => {
    const { profileId } = request.params as any;
    if (!profileId) return { items: [] };
    const lists = await prisma.list.findMany({
      where: { profileId },
      include: { items: true },
    });
    return { items: lists };
  },
);

app.post(
  '/analytics',
  {
    schema: {
      body: {
        type: 'object',
        properties: {
          event: { type: 'string' },
          titleId: { type: 'string' },
          provider: { type: 'string' },
          deepLinkUsed: { type: 'boolean' },
          profileId: { type: 'string' },
          anonymousId: { type: 'string' },
        },
        required: ['event'],
      },
      response: { 204: { type: 'null' } },
    },
  },
  async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const isPrivate =
        request.headers['x-private-mode'] === 'true' || (request.query as any)?.private === 'true';
      if (!isPrivate) {
        logger.info('analytics_event', {
          event: body.event,
          titleId: body.titleId,
          provider: body.provider,
          deepLinkUsed: Boolean(body.deepLinkUsed),
          profileId: body.profileId,
          anonymousId: body.anonymousId,
          ip: (request.headers['x-forwarded-for'] as string) || (request.ip as string),
          ua: request.headers['user-agent'],
          ts: new Date().toISOString(),
        });
        // Optional forwarding to external analytics provider if configured
        const sinkUrl = process.env.ANALYTICS_WEBHOOK_URL;
        const sinkToken = process.env.ANALYTICS_TOKEN;
        if (sinkUrl) {
          try {
            await fetch(sinkUrl, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                ...(sinkToken ? { authorization: `Bearer ${sinkToken}` } : {}),
              },
              body: JSON.stringify({
                event: body.event,
                properties: {
                  title_id: body.titleId,
                  provider: body.provider,
                  deep_link_used: Boolean(body.deepLinkUsed),
                  profile_id: body.profileId,
                  anonymous_id: body.anonymousId,
                },
                sent_at: new Date().toISOString(),
              }),
            });
          } catch (err) {
            logger.warn('analytics_forward_failed', { err: String(err) });
          }
        }
      }
    } catch {}
    reply.code(204).send();
  },
);

app.post(
  '/profiles/:profileId/lists',
  {
    preHandler: authPreHandler,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          visibility: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { list: { type: 'object', additionalProperties: true } },
          required: ['list'],
        },
      },
    },
  },
  async (request) => {
    const { profileId } = request.params as any;
    const body = (request.body as any) || {};
    const name: string = body.name;
    const visibility: string = body.visibility || 'PRIVATE';
    if (!profileId || !name) return { error: 'invalid_input' };
    const list = await prisma.list.create({ data: { profileId, name, visibility } });
    return { list };
  },
);

app.post(
  '/lists/:listId/items',
  {
    preHandler: authPreHandler,
    schema: {
      body: {
        type: 'object',
        required: ['titleId'],
        properties: {
          titleId: { type: 'string' },
          position: { type: 'integer' },
          note: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            item: { type: 'object', additionalProperties: true },
            idempotent: { type: 'boolean' },
          },
          required: ['item'],
        },
      },
    },
  },
  async (request) => {
    const listId: string = String((request.params as any).listId || '');
    const body = (request.body as any) || {};
    const titleId: string = body.titleId;
    const position: number | undefined =
      typeof body.position === 'number' ? body.position : undefined;
    const note: string | undefined = typeof body.note === 'string' ? body.note : undefined;
    if (!listId || !titleId) return { error: 'invalid_input' };
    // Idempotent add: return existing if already present
    const existing = await prisma.listItem.findFirst({ where: { listId, titleId } });
    if (existing) return { item: existing, idempotent: true };
    const item = await prisma.listItem.create({
      data: { listId, titleId, position: position ?? null, note: note ?? null },
    });
    return { item };
  },
);

app.delete(
  '/lists/:listId/items/:itemId',
  {
    preHandler: authPreHandler,
    schema: {
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      },
    },
  },
  async (request) => {
    const { itemId } = request.params as any;
    if (!itemId) return { error: 'invalid_input' };
    await prisma.listItem.delete({ where: { id: itemId } });
    return { ok: true };
  },
);

// ---- Feedback ----
app.post(
  '/feedback',
  {
    preHandler: authPreHandler,
    schema: {
      body: {
        type: 'object',
        required: ['profileId', 'titleId', 'action'],
        properties: {
          profileId: { type: 'string' },
          titleId: { type: 'string' },
          action: { type: 'string', enum: ['LIKE', 'DISLIKE', 'SAVE'] },
          reasonOpt: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { suppressed: { type: 'boolean' }, feedback: { type: 'object' } },
        },
      },
    },
  },
  async (request) => {
    const body = (request.body as any) || {};
    const profileId: string = body.profileId;
    const titleId: string = body.titleId;
    const action: string = body.action;
    const reasonOpt: string | undefined =
      typeof body.reasonOpt === 'string' ? body.reasonOpt : undefined;
    const allowed = new Set(['LIKE', 'DISLIKE', 'SAVE']);
    if (!profileId || !titleId || !allowed.has(action)) return { error: 'invalid_input' };
    // Private mode: suppress write, still return success for UX
    const isPrivate =
      request.headers['x-private-mode'] === 'true' || (request.query as any)?.private === 'true';
    if (isPrivate) return { suppressed: true };
    const rec = await prisma.feedback.create({
      data: { profileId, titleId, action, reasonOpt: reasonOpt ?? null },
    });
    return { feedback: rec };
  },
);

// ---- Alerts (create/list) ----
app.get(
  '/profiles/:profileId/alerts',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          required: ['items'],
        },
      },
    },
  },
  async (request) => {
    const { profileId } = request.params as any;
    if (!profileId) return { items: [] };
    const alerts = await prisma.alert.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: alerts };
  },
);

// ---- Subscriptions (list/upsert/delete) ----
app.get(
  '/profiles/:profileId/subscriptions',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          required: ['items'],
        },
      },
    },
  },
  async (request) => {
    const profileId: string = String((request.params as any).profileId || '');
    if (!profileId) return { items: [] };
    const subs = await prisma.subscription.findMany({ where: { profileId, active: true } });
    return { items: subs };
  },
);

app.post(
  '/profiles/:profileId/subscriptions',
  {
    preHandler: authPreHandler,
    schema: {
      body: {
        type: 'object',
        required: ['service'],
        properties: {
          service: { type: 'string' },
          region: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { subscription: { type: 'object', additionalProperties: true } },
          required: ['subscription'],
        },
      },
    },
  },
  async (request) => {
    const profileId: string = String((request.params as any).profileId || '');
    const body = (request.body as any) || {};
    const service: string = body.service;
    const region: string | undefined = typeof body.region === 'string' ? body.region : undefined;
    if (!profileId || !service) return { error: 'invalid_input' };
    const sub = await prisma.subscription
      .upsert({
        where: { id: `${profileId}:${service}` },
        update: { active: true, region: region ?? null },
        create: { profileId, service, region: region ?? null, active: true },
      })
      .catch(async () => {
        // fallback when no composite key; find existing
        const existing = await prisma.subscription.findFirst({ where: { profileId, service } });
        if (existing)
          return prisma.subscription.update({
            where: { id: existing.id },
            data: { active: true, region: region ?? null },
          });
        return prisma.subscription.create({
          data: { profileId, service, region: region ?? null, active: true },
        });
      });
    // Invalidate picks cache for today (both legacy and current cache versions)
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await app.redis?.del(`picks:${profileId}:${todayKey}`, `picks:v2:${profileId}:${todayKey}`);
    } catch {}
    return { subscription: sub };
  },
);

app.delete(
  '/profiles/:profileId/subscriptions',
  {
    preHandler: authPreHandler,
    schema: {
      body: {
        type: 'object',
        required: ['service'],
        properties: { service: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      },
    },
  },
  async (request) => {
    const profileId: string = String((request.params as any).profileId || '');
    const body = (request.body as any) || {};
    const service: string = body.service;
    if (!profileId || !service) return { error: 'invalid_input' };
    const existing = await prisma.subscription.findFirst({
      where: { profileId, service, active: true },
    });
    if (!existing) return { ok: true };
    await prisma.subscription.update({ where: { id: existing.id }, data: { active: false } });
    // Invalidate picks cache for today (both legacy and current cache versions)
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await app.redis?.del(`picks:${profileId}:${todayKey}`, `picks:v2:${profileId}:${todayKey}`);
    } catch {}
    return { ok: true };
  },
);

app.post(
  '/profiles/:profileId/alerts',
  {
    preHandler: authPreHandler,
    schema: {
      body: {
        type: 'object',
        properties: {
          titleId: { type: 'string' },
          services: { type: 'array', items: { type: 'string' }, minItems: 1 },
          region: { type: 'string' },
        },
        anyOf: [{ required: ['titleId'] }, { required: ['services'] }],
      },
      response: {
        200: {
          type: 'object',
          properties: { alert: { type: 'object', additionalProperties: true } },
          required: ['alert'],
        },
      },
    },
  },
  async (request) => {
    const profileId: string = String((request.params as any).profileId || '');
    const body = (request.body as any) || {};
    const titleId: string | undefined = body.titleId;
    const services: string[] = Array.isArray(body.services) ? body.services : [];
    const region: string = typeof body.region === 'string' ? body.region : 'US';
    if (!profileId || (!titleId && services.length === 0)) return { error: 'invalid_input' };
    const data: any = { profileId, alertType: 'AVAILABILITY', services, region, status: 'ACTIVE' };
    if (titleId) data.titleId = titleId;
    const rec = await prisma.alert.create({ data });
    return { alert: rec };
  },
);

// ---- Picks v1 (simple rules) ----
app.get(
  '/picks/:profileId',
  {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          required: ['items'],
        },
      },
    },
  },
  async (request) => {
    const { profileId } = request.params as any;
    if (!profileId) return { items: [] };

    const reqId = (request as any).requestId || '';
    const startTotal = Date.now();
    const t0 = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10);
    // Bump cache key version to ensure new fields like watchUrl are present
    const cacheKey = `picks:v2:${profileId}:${todayKey}`;
    try {
      const cached = await app.redis?.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const subs = await prisma.subscription.findMany({ where: { profileId, active: true } });
    const services = subs.map((s) => s.service);
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    const region = profile?.locale?.split('-')[1] || 'US';

    const tCandidateStart = Date.now();
    // candidates: titles with availability in user's services/region
    const titles = await prisma.title.findMany({
      take: 300,
      orderBy: { createdAt: 'desc' },
      include: { availability: true },
    });
    const candidateGenMs = Date.now() - tCandidateStart;

    function score(t: any): number {
      let s = 0;
      // availability match boost
      const avail = (t.availability || []).some(
        (a: any) => services.includes(a.service) && a.region === region,
      );
      if (avail) s += 2.5;
      // ratings (normalized ~0..1)
      if (typeof t.voteAverage === 'number') s += Math.min(Math.max(t.voteAverage, 0), 10) / 10;
      // light recency bias
      if (t.releaseYear) s += Math.max(0, t.releaseYear - 2000) / 200;
      // presence of imagery
      if (t.posterUrl || t.backdropUrl) s += 0.2;
      return s;
    }

    function buildReason(t: any, services: string[], region: string): string {
      const bits: string[] = [];
      if ((t.availability || []).some((a: any) => services.includes(a.service))) {
        bits.push(`on ${((t.availability || [])
          .map((a: any) => a.service)
          .filter((v: any, i: number, arr: any[]) => v && arr.indexOf(v) === i)[0] || 'your services'}`);
      }
      if (typeof t.voteAverage === 'number' && t.voteAverage >= 8.5) bits.push('highly rated');
      if (t.releaseYear && t.releaseYear >= new Date().getFullYear() - 1) bits.push('new');
      const reason = bits.length ? bits.join(' • ') : `matches your services`;
      return `Because it ${reason} in ${region}`;
    }

    const tRankStart = Date.now();
    const filtered = titles
      .filter((t: any) =>
        (t.availability || []).some(
          (a: any) => services.includes(a.service) && a.region === region,
        ),
      )
      .map((t: any) => ({ ...t, _score: score(t) }))
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 6)
      .map((t: any) => {
        const match = (t.availability || []).find(
          (a: any) => services.includes(a.service) && a.region === region,
        );
        const availabilityServices = Array.from(
          new Set((t.availability || []).map((a: any) => a.service).filter(Boolean)),
        );
        const watchUrl =
          match?.deepLink ||
          (match?.service
            ? normalizeDeepLink({
                service: match.service,
                titleName: t.name,
                tmdbId: t.tmdbId ? String(t.tmdbId) : undefined,
                type: t.type,
                releaseYear: t.releaseYear,
              })
            : undefined);
        return {
          id: t.id,
          name: t.name,
          type: t.type,
          releaseYear: t.releaseYear,
          posterUrl: t.posterUrl || undefined,
          voteAverage: typeof t.voteAverage === 'number' ? t.voteAverage : undefined,
          availabilityServices,
          watchUrl,
          reason: buildReason(t, services, region),
        };
      });
    const rankMs = Date.now() - tRankStart;

    const response = { items: filtered };
    try {
      await app.redis?.setEx(cacheKey, 60 * 60 * 12, JSON.stringify(response));
    } catch {}

    // analytics: picks_served (server-side)
    try {
      const totalMs = Date.now() - startTotal;
      const items = filtered.map((it: any, i: number) => ({
        titleId: it.id,
        rank: i + 1,
        score: (it as any)._score,
        reason: it.reason,
        availabilityServices: it.availabilityServices,
        availabilityRegions: [region],
        isExpiringSoon: false,
        isNew: Boolean(it.releaseYear && it.releaseYear >= new Date().getFullYear() - 1),
        diversityBucket: (it.availabilityServices || [])[0] || 'unknown',
      }));
      const evt = {
        event: 'picks_served',
        profileId,
        requestId: reqId,
        region,
        servicesFilter: services,
        rankerVersion: 'picks@1.0.0',
        candidateSource: 'db_recent+availability',
        items,
        latency: { candidateGenMs, rankMs, totalMs },
        exp: {},
      } as any;
      // forward via webhook if configured
      const sinkUrl = process.env.ANALYTICS_WEBHOOK_URL;
      const sinkToken = process.env.ANALYTICS_TOKEN;
      if (sinkUrl) {
        fetch(sinkUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(sinkToken ? { authorization: `Bearer ${sinkToken}` } : {}) },
          body: JSON.stringify(evt),
        }).catch((err) => logger.warn('analytics_forward_failed', { err: String(err) }));
      } else {
        logger.info('analytics_event', evt);
      }
    } catch {}
    return response;
  },
);

// attach redis
declare module 'fastify' {
  interface FastifyInstance {
    redis?: ReturnType<typeof createClient>;
  }
}

app.addHook('onReady', async () => {
  // Skip Redis in test env to keep tests fast and deterministic
  if (process.env.NODE_ENV === 'test') return;
  try {
    const client = createClient({ url: REDIS_URL });
    client.on('error', (err) => logger.warn('redis_error', { err: String(err) }));
    await client.connect();
    app.redis = client;
  } catch (err) {
    logger.warn('redis_disabled_or_unreachable', { err: String(err) });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
    logger.info(`API listening on http://localhost:${PORT}`);
  });
}

export default app;
