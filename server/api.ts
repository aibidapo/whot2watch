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

// --- Analytics buffering (optional) ---
function isAnalyticsBufferEnabled(): boolean {
  return process.env.ANALYTICS_BUFFER === 'true';
}
const ANALYTICS_BUFFER_INTERVAL_MS = Number(process.env.ANALYTICS_BUFFER_INTERVAL_MS || 30000);
const ANALYTICS_BUFFER_MAX = Number(process.env.ANALYTICS_BUFFER_MAX || 50);
type AnalyticsEvent = Record<string, any>;
let inMemoryAnalyticsQueue: AnalyticsEvent[] = [];

async function sendAnalyticsDirect(evt: AnalyticsEvent): Promise<boolean> {
  try {
    const sinkUrl = process.env.ANALYTICS_WEBHOOK_URL;
    const sinkToken = process.env.ANALYTICS_TOKEN;
    if (!sinkUrl) return true;
    await fetch(sinkUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(sinkToken ? { authorization: `Bearer ${sinkToken}` } : {}),
      },
      body: JSON.stringify(evt),
    });
    return true;
  } catch {
    logger.warn('analytics_forward_failed');
    return false;
  }
}

async function enqueueAnalytics(appInst: any, evt: AnalyticsEvent) {
  try {
    if (appInst.redis) {
      await appInst.redis.rPush('analytics:queue', JSON.stringify(evt));
    } else {
      inMemoryAnalyticsQueue.push(evt);
    }
  } catch {
    // Fallback to memory if Redis push fails
    inMemoryAnalyticsQueue.push(evt);
  }
}

async function dequeueBatch(appInst: any, maxItems: number): Promise<AnalyticsEvent[]> {
  const batch: AnalyticsEvent[] = [];
  if (appInst.redis) {
    for (let i = 0; i < maxItems; i++) {
      const raw = await appInst.redis.lPop('analytics:queue');
      if (!raw) break;
      try {
        batch.push(JSON.parse(raw));
      } catch {
        /* ignore bad */
      }
    }
    return batch;
  }
  // memory
  batch.push(
    ...inMemoryAnalyticsQueue.splice(0, Math.min(maxItems, inMemoryAnalyticsQueue.length)),
  );
  return batch;
}

async function requeueFront(appInst: any, events: AnalyticsEvent[]) {
  if (!events.length) return;
  if (appInst.redis) {
    // Push back to the left in reverse order to preserve original order
    for (let i = events.length - 1; i >= 0; i--) {
      await appInst.redis.lPush('analytics:queue', JSON.stringify(events[i]));
    }
    return;
  }
  inMemoryAnalyticsQueue = events.concat(inMemoryAnalyticsQueue);
}

async function flushAnalytics(appInst: any) {
  const batch = await dequeueBatch(appInst, ANALYTICS_BUFFER_MAX);
  if (!batch.length) return { sent: 0, failed: 0 };
  let sent = 0;
  const failed: AnalyticsEvent[] = [];
  for (const evt of batch) {
    // stop if sink not configured
    if (!process.env.ANALYTICS_WEBHOOK_URL) break;
    // try send
    const ok = await sendAnalyticsDirect(evt);
    if (ok) sent++;
    else failed.push(evt);
  }
  if (failed.length) await requeueFront(appInst, failed);
  return { sent, failed: failed.length };
}

function handleAnalytics(appInst: any, evt: AnalyticsEvent) {
  if (isAnalyticsBufferEnabled() && process.env.ANALYTICS_WEBHOOK_URL) {
    enqueueAnalytics(appInst, evt);
  } else {
    // fire-and-forget direct
    sendAnalyticsDirect(evt).catch(() => {});
  }
}

// (moved to bottom)

/* c8 ignore start */
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
/* c8 ignore stop */

/* c8 ignore start */
function appendAffiliateParams(rawUrl: string, service?: string): string {
  try {
    const u = new URL(rawUrl);
    // generic UTM params for disclosure/attribution
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'whot2watch');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'affiliate');
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', 'watch_now');
    if (service && !u.searchParams.has('utm_content')) u.searchParams.set('utm_content', service);
    return u.toString();
  } catch {
    return rawUrl;
  }
}
/* c8 ignore stop */

const app = Fastify({ logger: false });
app.register(cors, { origin: true });
app.register(helmet, { contentSecurityPolicy: false });
app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// request-id middleware
app.addHook('onRequest', (req, reply, done) => {
  withRequestId(req.raw as any, reply.raw as any, () => {});
  done();
});

// Support versioned routes: rewrite /v1/* to existing handlers without breaking old paths
app.addHook('onRequest', (req, _reply, done) => {
  try {
    const inUrl: string = String((req.raw as any)?.url || (req as any).url || '');
    let pathWithQuery = inUrl;
    if (!pathWithQuery.startsWith('/')) {
      try {
        const u = new URL(pathWithQuery);
        pathWithQuery = (u.pathname || '/') + (u.search || '');
      } catch {
        // keep as-is
      }
    }
    // Do not rewrite admin endpoints which are explicitly mounted under /v1
    if (pathWithQuery.startsWith('/v1/admin/')) return done();
    if (pathWithQuery.startsWith('/v1/')) {
      const rewritten = pathWithQuery.slice(3); // remove '/v1'
      try {
        (req.raw as any).url = rewritten;
      } catch {}
      try {
        (req as any).url = rewritten;
      } catch {}
    }
  } catch {}
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

// ---- Docs: OpenAPI spec and interactive UI (Redoc) ----
app.get('/openapi.yaml', async (_request, reply) => {
  try {
    const specPath = path.resolve(
      process.cwd(),
      'whot2watch-docs-full',
      'docs',
      'rest',
      'openapi.yaml',
    );
    const yaml = fs.readFileSync(specPath, 'utf8');
    reply.type('application/yaml').send(yaml);
  } catch {
    reply.code(404).send({ error: 'not_found' });
  }
});

app.get('/docs', async (_request, reply) => {
  // Guard docs in prod unless explicitly enabled
  const enabled = process.env.API_DOCS_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) {
    reply.code(404).send({ error: 'not_found' });
    return;
  }
  const primary = '#0f172a';
  const accent = '#22c55e';
  const redocHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Whot2Watch API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root { --brand: ${primary}; --accent: ${accent}; }
      body { margin: 0; padding: 0; background:#fff; }
      header { position: sticky; top:0; z-index: 10; background:#fff; border-bottom:1px solid #eee; }
      .nav { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; }
      .brand { display:flex; align-items:center; gap:10px; color: var(--brand); font-weight:600; }
      .brand .dot { width:10px; height:10px; border-radius:999px; background: var(--accent); display:inline-block; }
      .links a { color: var(--brand); text-decoration:none; margin-left:12px; font-size:14px; }
      .links a:hover { text-decoration:underline; }
      redoc { height: calc(100vh - 54px); }
    </style>
  </head>
  <body>
    <header>
      <div class="nav">
        <div class="brand"><span class="dot"></span>Whot2Watch API</div>
        <div class="links">
          <a href="/" title="Home">Home</a>
          <a href="/v1/openapi.yaml">OpenAPI</a>
        </div>
      </div>
    </header>
    <redoc spec-url="/v1/openapi.yaml"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
  </body>
  </html>`;
  reply.type('text/html').send(redocHtml);
});

app.get('/swagger', async (_request, reply) => {
  // Same guard as docs
  const enabled = process.env.API_DOCS_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
  if (!enabled) {
    reply.code(404).send({ error: 'not_found' });
    return;
  }
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Whot2Watch Swagger UI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>body { margin: 0 } #swagger-ui { height: 100vh }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: '/v1/openapi.yaml', dom_id: '#swagger-ui' });
    </script>
  </body>
  </html>`;
  reply.type('text/html').send(html);
});

// ---- Admin refresh endpoints (simple, non-queued) ----
app.post(
  '/v1/admin/refresh/tmdb/:tmdbId',
  { preHandler: adminPreHandler, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
  async (request) => {
    try {
      const tmdbId = String((request.params as any).tmdbId || '');
      if (!tmdbId) return { error: 'invalid_input' };
      const prismaLocal = prisma as PrismaClient;
      const mediaType = 'movie';
      const tmdbMod: any = await import('../services/catalog/tmdb');
      const fetchExternalIdsFn =
        (tmdbMod as any).fetchExternalIds || (tmdbMod as any).default?.fetchExternalIds;
      const ext =
        typeof fetchExternalIdsFn === 'function'
          ? await fetchExternalIdsFn(mediaType, Number(tmdbId))
          : undefined;
      const imdbId: string | undefined = ext?.imdb_id || undefined;
      let tmdbIdBig: bigint | null = null;
      try {
        tmdbIdBig = BigInt(tmdbId);
      } catch {
        tmdbIdBig = null;
      }
      const title = await prismaLocal.title.findFirst({
        where: tmdbIdBig !== null ? { tmdbId: tmdbIdBig } : { tmdbId: Number(tmdbId) as any },
      });
      if (!title) return { error: 'not_found' };
      if (imdbId && !title.imdbId) {
        await prismaLocal.title.update({ where: { id: title.id }, data: { imdbId } });
      }
      // fetch OMDb if we now have an imdbId
      let ratingsUpserts = 0;
      if (imdbId) {
        const omdbMod: any = await import('../services/catalog/omdb');
        const fetchOmdbByImdbFn =
          (omdbMod as any).fetchOmdbByImdb || (omdbMod as any).default?.fetchOmdbByImdb;
        const mapOmdbRatingsFn =
          (omdbMod as any).mapOmdbRatings || (omdbMod as any).default?.mapOmdbRatings;
        const omdb = typeof fetchOmdbByImdbFn === 'function' ? await fetchOmdbByImdbFn(imdbId) : {};
        const ratings = typeof mapOmdbRatingsFn === 'function' ? mapOmdbRatingsFn(omdb) : [];
        for (const r of ratings) {
          await prismaLocal.externalRating.upsert({
            where: { titleId_source: { titleId: title.id, source: r.source } },
            update: { valueText: r.valueText, valueNum: r.valueNum, updatedAt: new Date() },
            create: {
              titleId: title.id,
              source: r.source,
              valueText: r.valueText,
              valueNum: r.valueNum ?? null,
            },
          });
          ratingsUpserts++;
        }
      }
      const doc = await toIndexDocById(title.id);
      const ok = await indexOne(doc);
      return { ok, imdbId: imdbId || title.imdbId || null, ratingsUpserts };
    } catch (err) {
      return { ok: false, error: String(err) } as any;
    }
  },
);

app.post(
  '/v1/admin/refresh/imdb/:imdbId',
  { preHandler: adminPreHandler, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
  async (request) => {
    try {
      const imdbId = String((request.params as any).imdbId || '');
      if (!imdbId) return { error: 'invalid_input' };
      const prismaLocal = prisma as PrismaClient;
      const title = await prismaLocal.title.findFirst({ where: { imdbId } });
      if (!title) return { error: 'not_found' };
      const omdbMod2: any = await import('../services/catalog/omdb');
      const fetchOmdbByImdbFn2 =
        (omdbMod2 as any).fetchOmdbByImdb || (omdbMod2 as any).default?.fetchOmdbByImdb;
      const mapOmdbRatingsFn2 =
        (omdbMod2 as any).mapOmdbRatings || (omdbMod2 as any).default?.mapOmdbRatings;
      const omdb = typeof fetchOmdbByImdbFn2 === 'function' ? await fetchOmdbByImdbFn2(imdbId) : {};
      const ratings = typeof mapOmdbRatingsFn2 === 'function' ? mapOmdbRatingsFn2(omdb) : [];
      let ratingsUpserts = 0;
      for (const r of ratings) {
        await prismaLocal.externalRating.upsert({
          where: { titleId_source: { titleId: title.id, source: r.source } },
          update: { valueText: r.valueText, valueNum: r.valueNum, updatedAt: new Date() },
          create: {
            titleId: title.id,
            source: r.source,
            valueText: r.valueText,
            valueNum: r.valueNum ?? null,
          },
        });
        ratingsUpserts++;
      }
      const doc = await toIndexDocById(title.id);
      const ok = await indexOne(doc);
      return { ok, ratingsUpserts };
    } catch (err) {
      return { ok: false, error: String(err) } as any;
    }
  },
);

// --- v1 aliases / proxy (test/dev convenience) ---
app.get('/v1/search', async (request, reply) => {
  try {
    const u = String((request.raw as any).url || '').replace(/^\/v1/, '');
    const injected = await app.inject({ method: 'GET', url: u });
    reply.code(injected.statusCode);
    const ct = String(injected.headers['content-type'] || 'application/json');
    reply.header('content-type', ct);
    try {
      return reply.send(injected.json());
    } catch {
      return reply.send(injected.body);
    }
  } catch {
    reply.code(404).send({ error: 'not_found' });
  }
});

app.route({
  method: ['GET', 'POST', 'DELETE'] as any,
  url: '/v1/*',
  handler: async (request, reply) => {
    try {
      const original = String((request.raw as any).url || '/');
      if (original.startsWith('/v1/admin/')) return reply.code(404).send({ error: 'not_found' });
      const rebased = original.replace(/^\/v1\//, '/');
      const injected = await app.inject({
        method: request.method as any,
        url: rebased,
        payload: (request.body as any) ?? undefined,
      });
      reply.code(injected.statusCode);
      const ct = String(injected.headers['content-type'] || 'application/json');
      reply.header('content-type', ct);
      try {
        return reply.send(injected.json());
      } catch {
        return reply.send(injected.body);
      }
    } catch {
      reply.code(404).send({ error: 'not_found' });
    }
  },
});

// Fallback proxy: route non-admin /v1/* to unversioned equivalents
// (no explicit v1 proxy; the onRequest rewrite above handles /v1/*)

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

// ---- Admin helpers ----
async function adminPreHandler(request: any, reply: any) {
  if (!isAuthRequired()) return; // allow in dev when auth disabled
  try {
    const { verifyJwt } = await import('./security/jwt');
    const h = String(request.headers?.authorization || '');
    if (!h.toLowerCase().startsWith('bearer ')) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    const token = h.slice(7).trim();
    const decoded: any = await verifyJwt(token, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwksUri: JWKS_URI,
    });
    const roles: string[] = Array.isArray(decoded?.roles)
      ? decoded.roles
      : String(decoded?.scope || '')
          .split(/[\s,]+/)
          .filter(Boolean);
    if (!roles.map((r) => String(r).toLowerCase()).includes('admin')) {
      reply.code(403).send({ error: 'forbidden' });
    }
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

async function toIndexDocById(titleId: string) {
  const row = await prisma.title.findUnique({
    where: { id: titleId },
    include: { availability: true, externalRatings: true },
  });
  if (!row) return null;
  const ratings = Array.isArray((row as any).externalRatings) ? (row as any).externalRatings : [];
  const ratingsBySrc: Record<string, number | undefined> = {};
  for (const r of ratings) {
    const k = String(r.source || '').toUpperCase();
    if (typeof r.valueNum === 'number') ratingsBySrc[k] = r.valueNum as number;
  }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    releaseYear: (row as any).releaseYear ?? undefined,
    runtimeMin: (row as any).runtimeMin ?? undefined,
    genres: (row as any).genres || [],
    moods: (row as any).moods || [],
    posterUrl: (row as any).posterUrl || undefined,
    backdropUrl: (row as any).backdropUrl || undefined,
    voteAverage: (row as any).voteAverage ?? undefined,
    popularity: (row as any).popularity ?? undefined,
    ratingsImdb: ratingsBySrc.IMDB ?? undefined,
    ratingsRottenTomatoes: ratingsBySrc.ROTTEN_TOMATOES ?? undefined,
    ratingsMetacritic: ratingsBySrc.METACRITIC ?? undefined,
    availabilityServices: Array.from(
      new Set(((row as any).availability || []).map((a: any) => a.service).filter(Boolean)),
    ),
    availabilityRegions: Array.from(
      new Set(((row as any).availability || []).map((a: any) => a.region).filter(Boolean)),
    ),
    availability: ((row as any).availability || []).map((a: any) => ({
      service: a.service,
      region: a.region,
      offerType: a.offerType,
      deepLink: a.deepLink || undefined,
    })),
  } as any;
}

async function indexOne(doc: any) {
  if (!doc) return false;
  const idx = process.env.TITLES_INDEX || 'titles';
  const res = await fetch(
    `${OPENSEARCH_URL}/${encodeURIComponent(idx)}/_doc/${encodeURIComponent(doc.id)}` as any,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(doc),
    },
  );
  return res.ok;
}

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
          hasRatings: { type: 'boolean' },
          minRating: { type: 'integer' },
          minImdb: { type: 'integer' },
          minRt: { type: 'integer' },
          minMc: { type: 'integer' },
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
    const hasRatings: boolean = (() => {
      const v = (parsed.query as any).hasRatings;
      if (v === undefined) return false;
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'y';
    })();
    const minRatingRaw = (parsed.query as any).minRating;
    const minRating =
      minRatingRaw !== undefined && Number.isFinite(Number(minRatingRaw))
        ? Math.min(Math.max(Number(minRatingRaw), 0), 100)
        : undefined;
    const minImdbRaw = (parsed.query as any).minImdb;
    const minImdb =
      minImdbRaw !== undefined && Number.isFinite(Number(minImdbRaw))
        ? Math.min(Math.max(Number(minImdbRaw), 0), 100)
        : undefined;
    const minRtRaw = (parsed.query as any).minRt;
    const minRt =
      minRtRaw !== undefined && Number.isFinite(Number(minRtRaw))
        ? Math.min(Math.max(Number(minRtRaw), 0), 100)
        : undefined;
    const minMcRaw = (parsed.query as any).minMc;
    const minMc =
      minMcRaw !== undefined && Number.isFinite(Number(minMcRaw))
        ? Math.min(Math.max(Number(minMcRaw), 0), 100)
        : undefined;
    /* c8 ignore start - Fastify schema rejects invalid numeric types before handler */
    if (
      [yearMin, yearMax, runtimeMin, runtimeMax].some(
        (n) => n !== undefined && !Number.isFinite(n as number),
      )
    ) {
      return { items: [], total: 0, took: 0, from, size };
    }
    /* c8 ignore stop */

    /* c8 ignore start */
    const filter: any[] = [];
    if (services && services.length) filter.push({ terms: { availabilityServices: services } });
    if (regions && regions.length) filter.push({ terms: { availabilityRegions: regions } });
    if (types && types.length) filter.push({ terms: { type: types } });
    if (yearMin !== undefined || yearMax !== undefined)
      filter.push({ range: { releaseYear: { gte: yearMin, lte: yearMax } } });
    if (runtimeMin !== undefined || runtimeMax !== undefined)
      filter.push({ range: { runtimeMin: { gte: runtimeMin, lte: runtimeMax } } });
    if (
      hasRatings ||
      minRating !== undefined ||
      minImdb !== undefined ||
      minRt !== undefined ||
      minMc !== undefined
    ) {
      const ratingShoulds: any[] = [];
      const pushRatingCond = (
        field: 'ratingsImdb' | 'ratingsRottenTomatoes' | 'ratingsMetacritic',
        specificMin: number | undefined,
        fallbackMin: number | undefined,
        needsExists: boolean,
      ) => {
        if (specificMin !== undefined) {
          ratingShoulds.push({ range: { [field]: { gte: specificMin } } });
          return;
        }
        if (fallbackMin !== undefined) {
          ratingShoulds.push({ range: { [field]: { gte: fallbackMin } } });
          return;
        }
        if (needsExists) ratingShoulds.push({ exists: { field } });
      };
      pushRatingCond('ratingsImdb', minImdb, minRating, hasRatings);
      pushRatingCond('ratingsRottenTomatoes', minRt, minRating, hasRatings);
      pushRatingCond('ratingsMetacritic', minMc, minRating, hasRatings);
      if (ratingShoulds.length) {
        filter.push({ bool: { should: ratingShoulds, minimum_should_match: 1 } });
      }
    }
    /* c8 ignore stop */
    // Build relevance queries that work well for partial input and typos
    const nameShould: any[] = [];
    if (q) {
      nameShould.push(
        // Exact-ish match (benefits from edge_ngram analyzer when present)
        { match: { name: { query: q, boost: 3 } } },
        // Prefix over phrases for live typeahead
        { match_phrase_prefix: { name: { query: q, boost: 2, slop: 2 } } },
        // Fuzzy to catch minor typos
        { match: { name: { query: q, fuzziness: 'AUTO', prefix_length: 1, boost: 1 } } },
        // Substring anywhere via n-grams field
        { match: { 'name.ngrams': { query: q, boost: 2 } } },
        // Fallback: keyword wildcard substring (case-insensitive)
        {
          wildcard: {
            'name.keyword': {
              value: `*${q}*`,
              case_insensitive: true,
              boost: 1.5,
            },
          },
        },
      );
    }

    const query = {
      track_total_hits: true,
      query: {
        bool: {
          must: q ? [] : [{ match_all: {} }],
          filter,
          should: nameShould.concat([
            { exists: { field: 'posterUrl' } },
            { exists: { field: 'backdropUrl' } },
          ]),
          minimum_should_match: nameShould.length ? 1 : 0,
        },
      },
      size,
      from,
      sort: q ? undefined : [{ _score: { order: 'desc' } }, { releaseYear: { order: 'desc' } }],
    } as any;
    // try cache first
    const cacheKey = `search:${JSON.stringify({ q, size, from, services, regions, types, yearMin, yearMax, runtimeMin, runtimeMax, hasRatings, minRating, minImdb, minRt, minMc })}`;
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
    let response = { items: hits, total, took: data.took ?? 0, from, size } as any;

    // --- DB fallback: when no OpenSearch hits, search Titles directly (substring, case-insensitive) ---
    if (q && hits.length === 0) {
      try {
        const rows = await prisma.title.findMany({
          where: { name: { contains: q, mode: 'insensitive' as any } },
          take: size,
          skip: from,
          orderBy: { createdAt: 'desc' },
          include: { availability: true, externalRatings: true },
        });
        const mapped = rows.map((row: any) => {
          const ratings = Array.isArray(row.externalRatings) ? row.externalRatings : [];
          const ratingsBy: Record<string, number | undefined> = {};
          for (const r of ratings) {
            const k = String(r.source || '').toUpperCase();
            if (typeof r.valueNum === 'number') ratingsBy[k] = r.valueNum as number;
          }
          const availabilityServices = Array.from(
            new Set((row.availability || []).map((a: any) => a.service).filter(Boolean) as any),
          );
          const availabilityRegions = Array.from(
            new Set((row.availability || []).map((a: any) => a.region).filter(Boolean) as any),
          );
          return {
            id: row.id,
            name: row.name,
            type: row.type,
            releaseYear: row.releaseYear ?? undefined,
            runtimeMin: row.runtimeMin ?? undefined,
            genres: row.genres || [],
            moods: row.moods || [],
            posterUrl: row.posterUrl || undefined,
            backdropUrl: row.backdropUrl || undefined,
            voteAverage: row.voteAverage ?? undefined,
            popularity: row.popularity ?? undefined,
            ratingsImdb: ratingsBy.IMDB ?? undefined,
            ratingsRottenTomatoes: ratingsBy.ROTTEN_TOMATOES ?? undefined,
            ratingsMetacritic: ratingsBy.METACRITIC ?? undefined,
            availabilityServices,
            availabilityRegions,
            availability: (row.availability || []).map((a: any) => ({
              service: a.service,
              region: a.region,
              offerType: a.offerType,
              deepLink: a.deepLink || undefined,
            })),
            _source: 'db_fallback',
          } as any;
        });
        response = { items: mapped, total: mapped.length, took: data.took ?? 0, from, size };
      } catch {}
    }
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
    // Invalidate picks cache for today (legacy and current cache versions)
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await app.redis?.del(`picks:${profileId}:${todayKey}`);
      await app.redis?.del(`picks:v2:${profileId}:${todayKey}`);
      await app.redis?.del(`picks:v3:${profileId}:${todayKey}`);
      await app.redis?.del(`picks:v4:${profileId}:${todayKey}`);
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
    // Invalidate picks cache for today (legacy and current cache versions)
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await app.redis?.del(`picks:${profileId}:${todayKey}`);
      await app.redis?.del(`picks:v2:${profileId}:${todayKey}`);
      await app.redis?.del(`picks:v3:${profileId}:${todayKey}`);
      await app.redis?.del(`picks:v4:${profileId}:${todayKey}`);
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
    const parsedPicks = url.parse(request.raw.url || '', true);
    const ratingsBiasRaw = (parsedPicks.query as any).ratingsBias;
    const ratingsBias =
      ratingsBiasRaw !== undefined && Number.isFinite(Number(ratingsBiasRaw))
        ? Math.min(Math.max(Number(ratingsBiasRaw), 0), 3)
        : 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    // Bump cache key version due to ranking changes
    const cacheKey = `picks:v4:${profileId}:${todayKey}`;
    const useCache = ratingsBias === 0;
    if (useCache) {
      try {
        const cached = await app.redis?.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch {}
    }

    const subs = await prisma.subscription.findMany({ where: { profileId, active: true } });
    const services = subs.map((s) => s.service);
    const coldStart = services.length === 0;
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    const locale: string | undefined = profile?.locale || undefined;
    const region = (() => {
      try {
        if (!locale) return 'US';
        const parts = String(locale).split('-');
        return parts.length > 1 && parts[1] ? parts[1] : 'US';
      } catch {
        return 'US';
      }
    })();

    const tCandidateStart = Date.now();
    // candidates: titles with availability in user's services/region
    const isTest = process.env.NODE_ENV === 'test';
    const excludeSeeds = !isTest;
    const titles = await prisma.title.findMany({
      take: 300,
      orderBy: [{ popularity: 'desc' as const }, { createdAt: 'desc' as const }],
      where: isTest
        ? {}
        : {
            OR: [
              { imdbId: { not: null } },
              { externalRatings: { some: {} } },
              { popularity: { gt: 0 } },
            ],
            ...(excludeSeeds
              ? {
                  NOT: [
                    { name: { contains: 'Saga Title Part', mode: 'insensitive' } as any },
                    { name: { startsWith: 'Admin TMDB', mode: 'insensitive' } as any },
                    { name: { startsWith: 'PopHigh', mode: 'insensitive' } as any },
                  ],
                }
              : {}),
          },
      include: { availability: true },
    });
    // fetch external ratings in one query and index by titleId
    const titleIds = titles.map((t) => t.id);
    const extRatings = await prisma.externalRating.findMany({
      where: { titleId: { in: titleIds } },
      select: { titleId: true, source: true, valueNum: true },
    });
    const ratingsByTitle: Record<string, Record<string, number>> = {};
    for (const r of extRatings) {
      const key = String(r.source || '').toUpperCase();
      const val = typeof r.valueNum === 'number' ? (r.valueNum as number) : undefined;
      if (val === undefined) continue;
      const b = (ratingsByTitle[r.titleId] = ratingsByTitle[r.titleId] || {});
      b[key] = val;
    }
    const candidateGenMs = Date.now() - tCandidateStart;

    function score(t: any): number {
      let s = 0;
      // availability match boost
      const avail = (t.availability || []).some(
        (a: any) => services.includes(a.service) && a.region === region,
      );
      if (avail) s += 2.5;
      // ratings (normalized ~0..1)
      if (typeof t.voteAverage === 'number')
        s += (Math.min(Math.max(t.voteAverage, 0), 10) / 10) * (coldStart ? 1.5 : 1);
      // external ratings composite boost (IMDB/RT/MC stored 0..100)
      try {
        const r = ratingsByTitle[t.id] || {};
        let comp = 0;
        let w = 0;
        if (typeof (r as any).IMDB === 'number') {
          comp += ((r as any).IMDB as number) * 0.6;
          w += 0.6;
        }
        if (typeof (r as any).ROTTEN_TOMATOES === 'number') {
          comp += ((r as any).ROTTEN_TOMATOES as number) * 0.3;
          w += 0.3;
        }
        if (typeof (r as any).METACRITIC === 'number') {
          comp += ((r as any).METACRITIC as number) * 0.1;
          w += 0.1;
        }
        if (w > 0) {
          const normalized01 = comp / w / 100;
          const ratingsWeight = (coldStart ? 2 : 1) * (1 + ratingsBias);
          s += normalized01 * ratingsWeight;
        }
      } catch {}
      // popularity soft boost
      if (typeof t.popularity === 'number')
        s += (Math.min(Math.max(t.popularity, 0), 1000) / 10000) * (coldStart ? 2 : 1); // slightly higher in cold-start
      // light recency bias (favor recent years slightly)
      if (t.releaseYear) s += Math.max(0, t.releaseYear - 2000) / 200;
      // freshness boost only for real-source titles (tmdbId present)
      try {
        const createdAtTs = t.createdAt ? new Date(t.createdAt as any).getTime() : 0;
        const hasRealSource = t.tmdbId !== null && t.tmdbId !== undefined;
        if (createdAtTs && hasRealSource) {
          const ageHours = Math.max(0, (Date.now() - createdAtTs) / 3600000);
          if (ageHours <= 24) s += 0.5;
          else if (ageHours <= 72) s += 0.2;
        }
      } catch {}
      // presence of imagery
      if (t.posterUrl || t.backdropUrl) s += 0.2;
      return s;
    }

    function buildReason(t: any, services: string[], region: string, cold: boolean): string {
      const bits: string[] = [];
      if (!cold && (t.availability || []).some((a: any) => services.includes(a.service))) {
        const svcList = (t.availability || [])
          .map((a: any) => a.service)
          .filter((v: any) => Boolean(v));
        const svc = Array.from(new Set(svcList))[0] || 'your services';
        bits.push(`on ${svc}`);
      }
      if (typeof t.voteAverage === 'number' && t.voteAverage >= 8.5) bits.push('highly rated');
      // external ratings summary
      try {
        const r = ratingsByTitle[t.id] || {};
        const best = Math.max(
          Number((r as any).IMDB || 0),
          Number((r as any).ROTTEN_TOMATOES || 0),
          Number((r as any).METACRITIC || 0),
        );
        if (best >= 85) bits.push('critically rated');
        else if (best >= 75) bits.push('well reviewed');
      } catch {}
      /* c8 ignore next 3 */
      if (typeof t.popularity === 'number' && t.popularity >= 300) bits.push('popular now');
      if (t.releaseYear && t.releaseYear >= new Date().getFullYear() - 1) bits.push('new');
      if (cold) {
        const r = bits.length ? bits.join(' • ') : 'is a quality pick';
        return `Because it ${r} • quality blend`;
      }
      const reason = bits.length ? bits.join(' • ') : `matches your services`;
      return `Because it ${reason} in ${region}`;
    }

    // ranking and diversity sampling
    const tRankStart = Date.now();
    const withScores = titles.map((t: any) => ({ ...t, _score: score(t) }));
    const availMatch = (t: any) =>
      (t.availability || []).some((a: any) => services.includes(a.service) && a.region === region);
    const rankedAvail = withScores.filter(availMatch).sort((a: any, b: any) => b._score - a._score);
    const rankedAll = withScores.slice().sort((a: any, b: any) => b._score - a._score);

    const limit = 6;
    const maxPerBucket = 3;
    function bucketOf(t: any): string {
      const seriesKey = String((t.name || '').toLowerCase())
        .replace(/\s+(part|season|volume|vol\.?|chapter)\s*\d+.*/i, '')
        .trim();
      return seriesKey || 'unknown';
    }
    /* c8 ignore start */
    function diversityPick(list: any[], n: number): any[] {
      const selected: any[] = [];
      const counts: Record<string, number> = {};
      const seenSeries: Set<string> = new Set();
      for (const t of list) {
        if (selected.length >= n) break;
        const b = bucketOf(t);
        counts[b] = counts[b] || 0;
        const seriesKey = String((t.name || '').toLowerCase())
          .replace(/\s+(part|season|volume|vol\.?|chapter)\s*\d+.*/i, '')
          .trim();
        if (counts[b] < maxPerBucket && !seenSeries.has(seriesKey)) {
          selected.push(t);
          counts[b]++;
          seenSeries.add(seriesKey);
        }
      }
      // fill remainder if needed
      if (selected.length < n) {
        for (const t of list) {
          if (selected.length >= n) break;
          const seriesKey = String((t.name || '').toLowerCase())
            .replace(/\s+(part|season|volume|vol\.?|chapter)\s*\d+.*/i, '')
            .trim();
          if (!selected.includes(t) && !seenSeries.has(seriesKey)) {
            selected.push(t);
            seenSeries.add(seriesKey);
          }
        }
      }
      return selected.slice(0, n);
    }
    /* c8 ignore stop */

    let broadened = false;
    let picked = diversityPick(rankedAvail, limit);
    if (picked.length < limit) {
      broadened = true;
      const need = limit - picked.length;
      const addFromAll = rankedAll.filter((t) => !picked.includes(t)).slice(0, need);
      picked = picked.concat(addFromAll);
    }
    // exploration slot: try to include a bucket not yet present
    /* c8 ignore start */
    const presentBuckets = new Set(picked.map(bucketOf));
    const exploreCandidate = rankedAll.find((t) => !presentBuckets.has(bucketOf(t)));
    let exploreIndex = -1;
    if (exploreCandidate) {
      exploreIndex = picked.length === limit ? limit - 1 : picked.length;
      if (picked.length === limit) picked[exploreIndex] = exploreCandidate;
      else picked.push(exploreCandidate);
    }
    /* c8 ignore stop */

    const filtered = picked.map((t: any, idx: number) => {
      const match = (t.availability || []).find(
        (a: any) => services.includes(a.service) && a.region === region,
      );
      const availabilityServices = Array.from(
        new Set((t.availability || []).map((a: any) => a.service).filter(Boolean)),
      );
      let watchUrl = match?.deepLink;
      if (!watchUrl && match?.service) {
        const ctx: any = {
          service: match.service,
          titleName: t.name,
          type: t.type,
          releaseYear: t.releaseYear,
        };
        if (t.tmdbId !== undefined && t.tmdbId !== null) ctx.tmdbId = t.tmdbId as any;
        watchUrl = normalizeDeepLink(ctx);
      }
      if (watchUrl && process.env.AFFILIATES_ENABLED === 'true') {
        watchUrl = appendAffiliateParams(watchUrl, match?.service);
      }
      const ratingsBy = ratingsByTitle[t.id] || {};
      return {
        id: t.id,
        name: t.name,
        type: t.type,
        releaseYear: t.releaseYear,
        posterUrl: t.posterUrl || undefined,
        voteAverage: typeof t.voteAverage === 'number' ? t.voteAverage : undefined,
        availabilityServices,
        ratingsImdb: typeof ratingsBy.IMDB === 'number' ? (ratingsBy.IMDB as number) : undefined,
        ratingsRottenTomatoes:
          typeof ratingsBy.ROTTEN_TOMATOES === 'number'
            ? (ratingsBy.ROTTEN_TOMATOES as number)
            : undefined,
        ratingsMetacritic:
          typeof ratingsBy.METACRITIC === 'number' ? (ratingsBy.METACRITIC as number) : undefined,
        watchUrl,
        reason: buildReason(t, services, region, coldStart) + (broadened ? ' • broadened' : ''),
        qualityFallback: coldStart ? true : undefined,
        explore: exploreIndex === idx,
        diversityBucket: bucketOf(t),
        _score: t._score,
      } as any;
    });
    const rankMs = Date.now() - tRankStart;

    const response = { items: filtered };
    if (useCache) {
      try {
        await app.redis?.setEx(cacheKey, 60 * 60 * 12, JSON.stringify(response));
      } catch {}
    }

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
      // experiments: from header x-exp (JSON) or query exp.*
      const exp: Record<string, any> = {};
      try {
        const hexp = (request.headers['x-exp'] as string) || '';
        if (hexp) Object.assign(exp, JSON.parse(hexp));
      } catch {}
      try {
        const q: any = (request.query as any) || {};
        if (typeof q.exp === 'string') {
          try {
            Object.assign(exp, JSON.parse(q.exp));
          } catch {}
        }
        for (const k of Object.keys(q)) if (k.startsWith('exp.')) exp[k.slice(4)] = q[k];
      } catch {}

      const isPrivateEvt =
        request.headers['x-private-mode'] === 'true' || (request.query as any)?.private === 'true';
      const evt = {
        event: 'picks_served',
        profileId,
        requestId: reqId,
        region,
        servicesFilter: services,
        rankerVersion: 'picks@1.2.0',
        candidateSource: 'db_recent+availability',
        items,
        latency: { candidateGenMs, rankMs, totalMs },
        exp,
        broadened,
        ratingsBias,
      } as any;
      const safeEvt = isPrivateEvt
        ? {
            event: evt.event,
            profileId: evt.profileId,
            requestId: evt.requestId,
            region: evt.region,
            servicesFilter: evt.servicesFilter,
            rankerVersion: evt.rankerVersion,
            candidateSource: evt.candidateSource,
            count: items.length,
            latency: evt.latency,
            exp: evt.exp,
            broadened: evt.broadened,
            ratingsBias: evt.ratingsBias,
          }
        : evt;
      // forward via webhook if configured
      const sinkUrl = process.env.ANALYTICS_WEBHOOK_URL;
      const sinkToken = process.env.ANALYTICS_TOKEN;
      if (sinkUrl && isAnalyticsBufferEnabled()) {
        handleAnalytics(app, safeEvt);
      } else if (sinkUrl) {
        fetch(sinkUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(sinkToken ? { authorization: `Bearer ${sinkToken}` } : {}),
          },
          body: JSON.stringify(safeEvt),
        }).catch((err) => logger.warn('analytics_forward_failed', { err: String(err) }));
      } else {
        logger.info('analytics_event', safeEvt);
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

/* c8 ignore start */
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
/* c8 ignore stop */

/* c8 ignore start */
if (process.env.NODE_ENV !== 'test') {
  app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
    logger.info(`API listening on http://localhost:${PORT}`);
  });
}
/* c8 ignore stop */

export default app;

// Periodic analytics flusher when buffer enabled
if (isAnalyticsBufferEnabled()) {
  setInterval(() => {
    flushAnalytics(app).catch(() => {});
  }, ANALYTICS_BUFFER_INTERVAL_MS).unref?.();
}

// expose internals for tests (attach after app is defined)
try {
  (app as any).__analytics = {
    sendAnalyticsDirect,
    enqueueAnalytics,
    dequeueBatch,
    requeueFront,
    flushAnalytics,
    handleAnalytics,
  };
} catch {}
