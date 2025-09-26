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

  it('ensureIndex throws on failure to create', async () => {
    ;(globalThis.fetch as any) = vi.fn(async (_input: any, init?: any) => {
      if (init?.method === 'HEAD') return new Response(undefined, { status: 404 })
      if (init?.method === 'PUT') return new Response('boom', { status: 500 })
      return new Response('{}', { status: 200 })
    })
    await expect(os.ensureIndex('titles', { settings: {} })).rejects.toThrow('Failed to create index')
  })

  it('indexDocument throws on failure', async () => {
    ;(globalThis.fetch as any) = vi.fn(async (_input: any, init?: any) => {
      if (init?.method === 'PUT') return new Response('boom', { status: 500 })
      return new Response('{}', { status: 200 })
    })
    await expect(os.indexDocument('titles', '1', { a: 1 })).rejects.toThrow('Failed to index doc')
  })
})


