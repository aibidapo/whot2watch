import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from './api'

let serverUrl = 'http://localhost:4001'

beforeAll(async () => {
  await app.listen({ port: 4001, host: '127.0.0.1' })
})

afterAll(async () => {
  await app.close()
})

describe('API contract', () => {
  it('healthz returns ok', async () => {
    const res = await fetch(`${serverUrl}/healthz`)
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('search basic returns items array', async () => {
    const res = await fetch(`${serverUrl}/search?size=1`)
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(Array.isArray(json.items)).toBe(true)
  })

  it('feedback suppressed in Private Mode', async () => {
    const res = await fetch(`${serverUrl}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-private-mode': 'true' },
      body: JSON.stringify({ profileId: '00000000-0000-0000-0000-000000000000', titleId: '00000000-0000-0000-0000-000000000000', action: 'LIKE' })
    })
    expect(res.ok).toBe(true)
    const json = await res.json()
    expect(json.suppressed).toBe(true)
  })
})
