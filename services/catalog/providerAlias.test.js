import { describe, it, expect } from 'vitest'
// CJS module under test
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { canonicalizeProvider } = require('./providerAlias')

describe('canonicalizeProvider', () => {
  it('handles aliases and defaults to OTHER', () => {
    expect(canonicalizeProvider('Netflix')).toBe('NETFLIX')
    expect(canonicalizeProvider('hbo max')).toBe('MAX')
    expect(canonicalizeProvider('UnknownProvider')).toBe('OTHER')
    expect(canonicalizeProvider(undefined)).toBe('OTHER')
  })
})
