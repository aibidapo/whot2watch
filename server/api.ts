import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from 'redis'
import { PrismaClient } from '@prisma/client'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { withRequestId } from './common/requestId'
import { logger } from './common/logger'

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200'
const PORT = Number(process.env.PORT || 4000)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const prisma = new PrismaClient()

function arr(v: unknown): string[] | undefined {
  if (v === undefined) return undefined
  if (Array.isArray(v)) return (v as string[]).filter(Boolean)
  const s = String(v)
  if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean)
  return [s]
}

const app = Fastify({ logger: false })
app.register(cors, { origin: true })
app.register(helmet, { contentSecurityPolicy: false })
app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// request-id middleware
app.addHook('onRequest', (req, reply, done) => {
  withRequestId(req.raw as any, reply.raw as any, () => {})
  done()
})

app.get('/healthz', async () => ({ ok: true }))

app.get('/', async (_request, reply) => {
  const htmlPath = path.resolve(process.cwd(), 'server', 'test-ui.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  reply.type('text/html').send(html)
})

app.get('/search', async (request) => {
  const parsed = url.parse((request.raw.url || ''), true)
  const q = (parsed.query.q as string) || ''
  const sizeRaw = Number(parsed.query.size ?? 20)
  const fromRaw = Number(parsed.query.from ?? 0)
  const size = Number.isFinite(sizeRaw) ? Math.min(Math.max(sizeRaw, 1), 100) : 20
  const from = Number.isFinite(fromRaw) ? Math.max(fromRaw, 0) : 0
  const services = arr(parsed.query.service)
  const regions = arr(parsed.query.region)
  const types = arr(parsed.query.type)
  const yearMin = parsed.query.yearMin !== undefined ? Number(parsed.query.yearMin) : undefined
  const yearMax = parsed.query.yearMax !== undefined ? Number(parsed.query.yearMax) : undefined
  const runtimeMin = parsed.query.runtimeMin !== undefined ? Number(parsed.query.runtimeMin) : undefined
  const runtimeMax = parsed.query.runtimeMax !== undefined ? Number(parsed.query.runtimeMax) : undefined
  if ([yearMin, yearMax, runtimeMin, runtimeMax].some((n) => n !== undefined && !Number.isFinite(n as number))) {
    return { items: [], total: 0, took: 0, from, size }
  }

  const filter: any[] = []
  if (services && services.length) filter.push({ terms: { availabilityServices: services } })
  if (regions && regions.length) filter.push({ terms: { availabilityRegions: regions } })
  if (types && types.length) filter.push({ terms: { type: types } })
  if (yearMin !== undefined || yearMax !== undefined) filter.push({ range: { releaseYear: { gte: yearMin, lte: yearMax } } })
  if (runtimeMin !== undefined || runtimeMax !== undefined) filter.push({ range: { runtimeMin: { gte: runtimeMin, lte: runtimeMax } } })
  const query = {
    track_total_hits: true,
    query: {
      bool: {
        must: q ? [{ match: { name: q } }] : [{ match_all: {} }],
        filter
      }
    },
    size,
    from,
    sort: q ? undefined : [{ releaseYear: { order: 'desc' } }, { _score: { order: 'desc' } }]
  }
  // try cache first
  const cacheKey = `search:${JSON.stringify({ q, size, from, services, regions, types, yearMin, yearMax, runtimeMin, runtimeMax })}`
  try {
    const cached = await app.redis?.get(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch {}

  const osRes = await fetch(`${OPENSEARCH_URL}/titles/_search`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query)
  })
  if (!osRes.ok) {
    const text = await osRes.text()
    logger.error('OpenSearch error', { status: osRes.status, text })
    return { items: [], total: 0, took: 0, from, size }
  }
  const data = await osRes.json()
  const hits = (data.hits?.hits || []).map((h: any) => ({ id: h._id, score: h._score, ...h._source }))
  const total = typeof data.hits?.total?.value === 'number' ? data.hits.total.value : hits.length
  const response = { items: hits, total, took: data.took ?? 0, from, size }
  try {
    await app.redis?.setEx(cacheKey, 60, JSON.stringify(response))
  } catch {}
  return response
})

// ---- Lists ----
app.get('/profiles/:profileId/lists', async (request) => {
  const { profileId } = (request.params as any)
  if (!profileId) return { items: [] }
  const lists = await prisma.list.findMany({
    where: { profileId },
    include: { items: true }
  })
  return { items: lists }
})

app.post('/profiles/:profileId/lists', async (request) => {
  const { profileId } = (request.params as any)
  const body = (request.body as any) || {}
  const name: string = body.name
  const visibility: string = body.visibility || 'PRIVATE'
  if (!profileId || !name) return { error: 'invalid_input' }
  const list = await prisma.list.create({ data: { profileId, name, visibility } })
  return { list }
})

app.post('/lists/:listId/items', async (request) => {
  const { listId } = (request.params as any)
  const body = (request.body as any) || {}
  const titleId: string = body.titleId
  const position: number | undefined = typeof body.position === 'number' ? body.position : undefined
  const note: string | undefined = typeof body.note === 'string' ? body.note : undefined
  if (!listId || !titleId) return { error: 'invalid_input' }
  const item = await prisma.listItem.create({ data: { listId, titleId, position, note } })
  return { item }
})

app.delete('/lists/:listId/items/:itemId', async (request) => {
  const { itemId } = (request.params as any)
  if (!itemId) return { error: 'invalid_input' }
  await prisma.listItem.delete({ where: { id: itemId } })
  return { ok: true }
})

// ---- Feedback ----
app.post('/feedback', async (request) => {
  const body = (request.body as any) || {}
  const profileId: string = body.profileId
  const titleId: string = body.titleId
  const action: string = body.action
  const reasonOpt: string | undefined = typeof body.reasonOpt === 'string' ? body.reasonOpt : undefined
  const allowed = new Set(['LIKE', 'DISLIKE', 'SAVE'])
  if (!profileId || !titleId || !allowed.has(action)) return { error: 'invalid_input' }
  // Private mode: suppress write, still return success for UX
  const isPrivate = request.headers['x-private-mode'] === 'true' || (request.query as any)?.private === 'true'
  if (isPrivate) return { suppressed: true }
  const rec = await prisma.feedback.create({ data: { profileId, titleId, action, reasonOpt } })
  return { feedback: rec }
})

// ---- Alerts (create/list) ----
app.get('/profiles/:profileId/alerts', async (request) => {
  const { profileId } = (request.params as any)
  if (!profileId) return { items: [] }
  const alerts = await prisma.alert.findMany({ where: { profileId }, orderBy: { createdAt: 'desc' } })
  return { items: alerts }
})

// ---- Subscriptions (list/upsert/delete) ----
app.get('/profiles/:profileId/subscriptions', async (request) => {
  const { profileId } = (request.params as any)
  if (!profileId) return { items: [] }
  const subs = await prisma.subscription.findMany({ where: { profileId, active: true } })
  return { items: subs }
})

app.post('/profiles/:profileId/subscriptions', async (request) => {
  const { profileId } = (request.params as any)
  const body = (request.body as any) || {}
  const service: string = body.service
  const region: string | undefined = typeof body.region === 'string' ? body.region : undefined
  if (!profileId || !service) return { error: 'invalid_input' }
  const sub = await prisma.subscription.upsert({
    where: { id: `${profileId}:${service}` },
    update: { active: true, region },
    create: { profileId, service, region, active: true }
  }).catch(async () => {
    // fallback when no composite key; find existing
    const existing = await prisma.subscription.findFirst({ where: { profileId, service } })
    if (existing) return prisma.subscription.update({ where: { id: existing.id }, data: { active: true, region } })
    return prisma.subscription.create({ data: { profileId, service, region, active: true } })
  })
  return { subscription: sub }
})

app.delete('/profiles/:profileId/subscriptions', async (request) => {
  const { profileId } = (request.params as any)
  const body = (request.body as any) || {}
  const service: string = body.service
  if (!profileId || !service) return { error: 'invalid_input' }
  const existing = await prisma.subscription.findFirst({ where: { profileId, service, active: true } })
  if (!existing) return { ok: true }
  await prisma.subscription.update({ where: { id: existing.id }, data: { active: false } })
  return { ok: true }
})

app.post('/profiles/:profileId/alerts', async (request) => {
  const { profileId } = (request.params as any)
  const body = (request.body as any) || {}
  const titleId: string | undefined = body.titleId
  const services: string[] = Array.isArray(body.services) ? body.services : []
  const region: string = typeof body.region === 'string' ? body.region : 'US'
  if (!profileId || (!titleId && services.length === 0)) return { error: 'invalid_input' }
  const rec = await prisma.alert.create({ data: { profileId, titleId, alertType: 'AVAILABILITY', services, region, status: 'ACTIVE' } })
  return { alert: rec }
})

// ---- Picks v1 (simple rules) ----
app.get('/picks/:profileId', async (request) => {
  const { profileId } = (request.params as any)
  if (!profileId) return { items: [] }

  const todayKey = new Date().toISOString().slice(0, 10)
  const cacheKey = `picks:${profileId}:${todayKey}`
  try {
    const cached = await app.redis?.get(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch {}

  const subs = await prisma.subscription.findMany({ where: { profileId, active: true } })
  const services = subs.map((s) => s.service)
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  const region = profile?.locale?.split('-')[1] || 'US'

  // candidates: titles with availability in user's services/region
  const titles = await prisma.title.findMany({
    take: 200,
    orderBy: { createdAt: 'desc' },
    include: { availability: true }
  })

  function score(t: any): number {
    let s = 0
    if (Array.isArray(t.genres)) s += Math.min(t.genres.length, 3) * 0.5
    if (t.releaseYear) s += Math.max(0, t.releaseYear - 1990) / 100
    const avail = (t.availability || []).some((a: any) => services.includes(a.service) && a.region === region)
    if (avail) s += 2
    return s
  }

  const filtered = titles
    .filter((t: any) => (t.availability || []).some((a: any) => services.includes(a.service) && a.region === region))
    .map((t: any) => ({ ...t, _score: score(t) }))
    .sort((a: any, b: any) => b._score - a._score)
    .slice(0, 5)
    .map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      releaseYear: t.releaseYear,
      reason: `Because it matches your services (${services.join(', ')}) in ${region}`
    }))

  const response = { items: filtered }
  try { await app.redis?.setEx(cacheKey, 60 * 60 * 12, JSON.stringify(response)) } catch {}
  return response
})

// attach redis
declare module 'fastify' {
  interface FastifyInstance { redis?: ReturnType<typeof createClient> }
}

app.addHook('onReady', async () => {
  const client = createClient({ url: REDIS_URL })
  client.on('error', (err) => logger.warn('redis_error', { err: String(err) }))
  await client.connect()
  app.redis = client
})

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  logger.info(`API listening on http://localhost:${PORT}`)
})


