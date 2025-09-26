import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from 'redis'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { withRequestId } from './common/requestId'
import { logger } from './common/logger'

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200'
const PORT = Number(process.env.PORT || 4000)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

function arr(v: unknown): string[] | undefined {
  if (v === undefined) return undefined
  if (Array.isArray(v)) return (v as string[]).filter(Boolean)
  const s = String(v)
  if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean)
  return [s]
}

const app = Fastify({ logger: false })
app.register(cors, { origin: true })

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


