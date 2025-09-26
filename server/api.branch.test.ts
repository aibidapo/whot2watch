import { describe, it, expect, beforeAll } from 'vitest'
import app from './api'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('API branch coverage', () => {
  let profileId: string
  let titleId: string

  beforeAll(async () => {
    const profile = await prisma.profile.findFirst()
    const title = await prisma.title.findFirst()
    profileId = profile!.id
    titleId = title!.id
  })

  it('search builds all filters and clamps size/from', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/search?q=matrix&size=150&from=-5&service=NETFLIX,DISNEY_PLUS&region=US,CA&type=MOVIE,SHOW&yearMin=2000&yearMax=2020&runtimeMin=60&runtimeMax=180'
    })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(Array.isArray(json.items)).toBe(true)
    expect(json.size).toBe(100) // clamped
    expect(json.from).toBe(0)   // clamped
  })

  it('lists create invalid input returns error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/lists`,
      payload: { visibility: 'PRIVATE' }
    })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(json.error).toBe('invalid_input')
  })

  it('subscriptions delete returns ok when none exists', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/profiles/${profileId}/subscriptions`,
      payload: { service: 'DISNEY_PLUS' }
    })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(json.ok).toBe(true)
  })

  it('alerts create with only services', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/profiles/${profileId}/alerts`,
      payload: { services: ['NETFLIX'], region: 'US' }
    })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(json.alert).toBeTruthy()
  })

  it('feedback persists when not private', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: { profileId, titleId, action: 'LIKE' }
    })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(json.feedback).toBeTruthy()
  })

  it('search returns cached result when present', async () => {
    const cached = { items: [{ id: 'x', name: 'cached' }], total: 1, from: 0, size: 1, took: 0 }
    ;(app as any).redis = {
      async get(key: string) { return key.startsWith('search:') ? JSON.stringify(cached) : null },
      async setEx() { /* no-op */ }
    }
    const res = await app.inject({ method: 'GET', url: '/search?size=1' })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(json.items[0].name).toBe('cached')
  })

  it('picks returns cached result when present', async () => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const cacheObj = { items: [{ id: titleId, name: 'cached pick' }] }
    ;(app as any).redis = {
      async get(key: string) { return key.includes(todayKey) ? JSON.stringify(cacheObj) : null },
      async setEx() { /* no-op */ }
    }
    const res = await app.inject({ method: 'GET', url: `/picks/${profileId}` })
    expect(res.statusCode).toBe(200)
    const json = res.json() as any
    expect(json.items[0].name).toBe('cached pick')
  })
})


