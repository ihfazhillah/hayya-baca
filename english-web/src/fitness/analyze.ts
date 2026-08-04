import { TARGET_PHONEMES } from './phonemes'

export interface PhonemeDelta {
  phoneme: string
  pass: number
  fail: number
}

/** Which target sounds a word likely contains (spelling-based, v1). */
export function targetPhonemesForWord(word: string): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return []
  const out: string[] = []
  for (const p of TARGET_PHONEMES) {
    if (p.match.test(w)) out.push(p.id)
  }
  return out
}

/** Turn a scored attempt (reference words + per-word correctness) into per-target
 *  pass/fail deltas. At most ONE delta per phoneme per attempt (no
 *  over-attribution); a phoneme wrong on any word this attempt counts as a fail
 *  even if another word had it right. `mapper` is injectable for tests. */
export function analyzeAttempt(
  refWords: string[],
  okFlags: boolean[],
  mapper: (w: string) => string[] = targetPhonemesForWord,
): PhonemeDelta[] {
  const failed = new Set<string>()
  const passed = new Set<string>()
  refWords.forEach((word, i) => {
    const ok = okFlags[i] ?? true
    for (const p of mapper(word)) (ok ? passed : failed).add(p)
  })
  const deltas: PhonemeDelta[] = []
  for (const p of new Set([...failed, ...passed])) {
    deltas.push(
      failed.has(p)
        ? { phoneme: p, pass: 0, fail: 1 }
        : { phoneme: p, pass: 1, fail: 0 },
    )
  }
  return deltas
}
