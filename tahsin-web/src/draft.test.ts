import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildBulkPayload,
  clearDraft,
  emptyRow,
  isTouched,
  loadDraft,
  saveDraft,
  type Draft,
} from './draft'

beforeEach(() => localStorage.clear())

describe('draft store', () => {
  it('round-trips through localStorage', () => {
    const d: Draft = { 5: { open: true, page: '44', page_detail: '', scores: { 1: 3 } } }
    saveDraft('2026-08-13', d)
    expect(loadDraft('2026-08-13')).toEqual(d)
  })

  it('clearDraft empties it', () => {
    saveDraft('2026-08-13', { 5: emptyRow() })
    clearDraft('2026-08-13')
    expect(loadDraft('2026-08-13')).toEqual({})
  })

  it('saving an empty draft removes the key', () => {
    saveDraft('2026-08-13', {})
    expect(localStorage.getItem('tahsin.draft.2026-08-13')).toBeNull()
  })
})

describe('isTouched', () => {
  it('closed rows are never touched', () => {
    expect(isTouched({ open: false, page: '44', page_detail: '', scores: {} })).toBe(false)
  })
  it('open but empty is not touched', () => {
    expect(isTouched(emptyRow())).toBe(false)
  })
  it('open with a page counts', () => {
    expect(isTouched({ open: true, page: '44', page_detail: '', scores: {} })).toBe(true)
  })
  it('open with a score counts', () => {
    expect(isTouched({ open: true, page: '', page_detail: '', scores: { 1: 0 } })).toBe(true)
  })
})

describe('buildBulkPayload', () => {
  it('includes only touched rows and maps fields', () => {
    const draft: Draft = {
      5: { open: true, page: '44', page_detail: 'ayat 1-10', scores: { 1: 3, 2: 5 } },
      6: { open: true, page: '', page_detail: '', scores: {} }, // skipped
      7: { open: false, page: '9', page_detail: '', scores: {} }, // skipped
      8: { open: true, page: '', page_detail: 'seperempat', scores: {} },
    }
    const out = buildBulkPayload('2026-08-13', draft)
    expect(out).toHaveLength(2)
    const five = out.find((r) => r.santri === 5)!
    expect(five).toMatchObject({
      santri: 5,
      date: '2026-08-13',
      page: 44,
      page_detail: 'ayat 1-10',
    })
    expect(five.scores).toEqual([
      { item: 1, value: 3 },
      { item: 2, value: 5 },
    ])
    const eight = out.find((r) => r.santri === 8)!
    expect(eight.page).toBeNull()
    expect(eight.page_detail).toBe('seperempat')
  })

  it('non-numeric page becomes null', () => {
    const draft: Draft = {
      5: { open: true, page: 'abc', page_detail: '', scores: { 1: 3 } },
    }
    expect(buildBulkPayload('2026-08-13', draft)[0].page).toBeNull()
  })
})
