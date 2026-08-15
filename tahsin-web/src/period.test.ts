import { describe, expect, it } from 'vitest'
import {
  isoWeek,
  label,
  monthRange,
  shift,
  weekRange,
  weekStart,
} from './period'

describe('period', () => {
  it('weekStart is the Monday of the week', () => {
    // 2026-08-13 is a Thursday
    expect(weekStart('2026-08-13')).toBe('2026-08-10')
    expect(weekStart('2026-08-10')).toBe('2026-08-10') // Monday stays
    expect(weekStart('2026-08-16')).toBe('2026-08-10') // Sunday → same Monday
  })

  it('weekRange is Monday..Sunday', () => {
    expect(weekRange('2026-08-13')).toEqual({
      start: '2026-08-10',
      end: '2026-08-16',
    })
  })

  it('monthRange covers the whole month', () => {
    expect(monthRange('2026-08-13')).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    })
    // February leap-ish check (2028 is a leap year)
    expect(monthRange('2028-02-10').end).toBe('2028-02-29')
  })

  it('shift moves by one unit', () => {
    expect(shift('week', '2026-08-13', -1)).toBe('2026-08-03')
    expect(shift('week', '2026-08-13', 1)).toBe('2026-08-17')
    expect(shift('month', '2026-08-13', 1)).toBe('2026-09-01')
    expect(shift('month', '2026-08-13', -1)).toBe('2026-07-01')
  })

  it('isoWeek gives the ISO week number', () => {
    expect(isoWeek('2026-08-13')).toBe(33)
    expect(isoWeek('2026-01-01')).toBe(1)
  })

  it('label reads naturally', () => {
    expect(label('month', '2026-08-13')).toBe('Agustus 2026')
    expect(label('week', '2026-08-13')).toBe('Pekan 33 · 10–16 Agu 2026')
  })
})
