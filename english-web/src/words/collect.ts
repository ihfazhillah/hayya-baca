import type { AttemptScore } from '../scoring'

export interface WordDelta {
  word: string
  fail: number
}

const norm = (w: string) =>
  w
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, '')
    .trim()

/** Mis-said words from a scored attempt → fail deltas (normalized, deduped).
 *  Auto-collects words to practice (Spec 069). */
export function wrongWordDeltas(score: AttemptScore): WordDelta[] {
  const seen = new Set<string>()
  const out: WordDelta[] = []
  for (const m of score.marks) {
    if (m.kind !== 'wrong') continue
    const word = norm(m.word)
    if (!word || seen.has(word)) continue
    seen.add(word)
    out.push({ word, fail: 1 })
  }
  return out
}
