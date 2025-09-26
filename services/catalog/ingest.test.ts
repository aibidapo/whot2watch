import { describe, it, expect } from 'vitest'
import { normalizeTitle, RawTitle } from './ingest'

describe('normalizeTitle', () => {
  it('normalizes basic fields and canonicalizes providers', () => {
    const raw: RawTitle = {
      name: 'Sample',
      type: 'MOVIE',
      releaseYear: 2020,
      runtimeMin: 100,
      genres: ['Action'],
      providers: ['Netflix', 'HBO Max']
    }
    const norm = normalizeTitle(raw, 'US')
    expect(norm.name).toBe('Sample')
    expect(norm.type).toBe('MOVIE')
    expect(norm.genres).toEqual(['Action'])
    expect(norm.availability.length).toBe(2)
    const services = norm.availability.map((a) => a.service)
    expect(services).toContain('NETFLIX')
    expect(services).toContain('MAX')
    expect(norm.availability.every((a) => a.region === 'US')).toBe(true)
  })
})


