import { describe, expect, it } from 'vitest'
import { parseSetupCode } from './setupCode'

describe('parseSetupCode', () => {
  it('pulls code from a full setup URL', () => {
    expect(
      parseSetupCode('https://ruangcerita.ihfazh.com/setup?code=abc123'),
    ).toBe('ABC123')
  })

  it('pulls code from a path-only URL', () => {
    expect(parseSetupCode('/setup?code=XYZ789')).toBe('XYZ789')
  })

  it('accepts a bare code', () => {
    expect(parseSetupCode(' abc123 ')).toBe('ABC123')
  })

  it('returns null for junk', () => {
    expect(parseSetupCode('https://example.com/other')).toBeNull()
    expect(parseSetupCode('')).toBeNull()
  })
})
