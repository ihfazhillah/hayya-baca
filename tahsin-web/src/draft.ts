/** Local draft store for bulk entry — survives app close (Spec 072).
 *  One draft per date: { [santriId]: { page, page_detail, scores } }.
 */
import type { RecordInput } from './types'

export interface DraftRow {
  open: boolean
  page: string
  page_detail: string
  scores: Record<number, number> // itemId -> 0..5 (absent = not assessed)
}

export type Draft = Record<number, DraftRow>

const key = (date: string) => `tahsin.draft.${date}`

export function loadDraft(date: string): Draft {
  try {
    const raw = localStorage.getItem(key(date))
    return raw ? (JSON.parse(raw) as Draft) : {}
  } catch {
    return {}
  }
}

export function saveDraft(date: string, draft: Draft): void {
  try {
    if (Object.keys(draft).length === 0) localStorage.removeItem(key(date))
    else localStorage.setItem(key(date), JSON.stringify(draft))
  } catch {
    /* ignore quota errors */
  }
}

export function clearDraft(date: string): void {
  localStorage.removeItem(key(date))
}

export function emptyRow(): DraftRow {
  return { open: false, page: '', page_detail: '', scores: {} }
}

/** A row counts as "touched" (worth submitting) if opened and has any data. */
export function isTouched(row: DraftRow): boolean {
  return (
    row.open &&
    (row.page.trim() !== '' ||
      row.page_detail.trim() !== '' ||
      Object.keys(row.scores).length > 0)
  )
}

/** Build the bulk POST payload from a draft on a given date. Pure. */
export function buildBulkPayload(date: string, draft: Draft): RecordInput[] {
  const out: RecordInput[] = []
  for (const [sid, row] of Object.entries(draft)) {
    if (!isTouched(row)) continue
    const pageNum = row.page.trim() === '' ? null : Number(row.page)
    out.push({
      santri: Number(sid),
      date,
      page: pageNum !== null && Number.isFinite(pageNum) ? pageNum : null,
      page_detail: row.page_detail.trim(),
      notes: '',
      scores: Object.entries(row.scores).map(([item, value]) => ({
        item: Number(item),
        value,
      })),
    })
  }
  return out
}
