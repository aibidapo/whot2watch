import { describe, it, expect } from 'vitest'
import { withRequestId } from './requestId'

describe('withRequestId', () => {
  it('sets x-request-id when missing and attaches to request object', () => {
    const req: any = { headers: {} }
    const headers: Record<string, string> = {}
    const res = { setHeader: (k: string, v: string) => { headers[k] = v } }
    let called = false
    const next = () => { called = true }

    withRequestId(req, res as any, next)

    expect(called).toBe(true)
    expect(typeof req.requestId).toBe('string')
    expect(req.requestId.length).toBeGreaterThan(10)
    expect(headers['x-request-id']).toBe(req.requestId)
  })

  it('respects existing x-request-id header', () => {
    const req: any = { headers: { 'x-request-id': 'abc-123' } }
    const headers: Record<string, string> = {}
    const res = { setHeader: (k: string, v: string) => { headers[k] = v } }
    const next = () => {}

    withRequestId(req, res as any, next)

    expect(req.requestId).toBe('abc-123')
    expect(headers['x-request-id']).toBe('abc-123')
  })
})


