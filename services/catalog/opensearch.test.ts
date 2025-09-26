import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as os from './opensearch'

describe('opensearch helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url.endsWith('/_doc/1') && init?.method === 'PUT') {
        return new Response('{}', { status: 201 })
      }
      if (init?.method === 'HEAD') {
        // index does not exist: force creation path
        return new Response(undefined, { status: 404 })
      }
      if (init?.method === 'PUT') {
        // create index
        return new Response('{}', { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as any)
  })

  it('ensureIndex creates when missing', async () => {
    await expect(os.ensureIndex('titles', { settings: {} })).resolves.toBeUndefined()
  })

  it('indexDocument indexes a doc', async () => {
    await expect(os.indexDocument('titles', '1', { a: 1 })).resolves.toBeUndefined()
  })
})


