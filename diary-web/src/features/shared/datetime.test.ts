import { describe, expect, it } from 'vitest'
import { formatPostTime } from './datetime'

// Fixed reference "now": Tue 28 Jul 2026, 15:00 local.
const NOW = new Date(2026, 6, 28, 15, 0)

describe('formatPostTime', () => {
  it('labels a same-day post as "Hari ini"', () => {
    expect(formatPostTime(new Date(2026, 6, 28, 9, 5).toISOString(), NOW)).toBe(
      'Hari ini, 09.05',
    )
  })

  it('labels the previous day as "Kemarin"', () => {
    expect(formatPostTime(new Date(2026, 6, 27, 20, 30).toISOString(), NOW)).toBe(
      'Kemarin, 20.30',
    )
  })

  it('shows day + month for the same year', () => {
    expect(formatPostTime(new Date(2026, 6, 20, 14, 0).toISOString(), NOW)).toBe(
      '20 Jul, 14.00',
    )
  })

  it('includes the year for a different year', () => {
    expect(formatPostTime(new Date(2025, 11, 31, 7, 9).toISOString(), NOW)).toBe(
      '31 Des 2025, 07.09',
    )
  })

  it('returns empty for null or invalid input', () => {
    expect(formatPostTime(null, NOW)).toBe('')
    expect(formatPostTime('not-a-date', NOW)).toBe('')
  })
})
