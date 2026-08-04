import { recordWeakpoints } from '../api'
import type { AttemptScore } from '../scoring'
import { analyzeAttempt } from './analyze'

/** After a scored attempt, attribute per-word correctness to target phonemes and
 *  persist the deltas (Spec 066). Fire-and-forget — never blocks or breaks the
 *  scoring UX; errors (offline, etc.) are ignored. */
export function recordAttempt(score: AttemptScore): Promise<void> {
  // Reference words are the 'correct'/'wrong' marks ('extra' = spoken-only).
  const ref = score.marks.filter((m) => m.kind !== 'extra')
  if (!ref.length) return Promise.resolve()
  const words = ref.map((m) => m.word)
  const ok = ref.map((m) => m.kind === 'correct')
  const deltas = analyzeAttempt(words, ok)
  if (!deltas.length) return Promise.resolve()
  return recordWeakpoints(deltas)
    .then(() => {})
    .catch(() => {})
}
