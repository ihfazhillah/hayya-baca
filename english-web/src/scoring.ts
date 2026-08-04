/** Word-level attempt scoring — identical logic to src/lib/english.ts in the
 *  React Native app (LCS alignment + fuzzball fuzzy equality), so scores are
 *  consistent across mobile and web.
 */

import * as fuzzball from 'fuzzball'

export type WordMark =
  | { kind: 'correct'; word: string }
  | { kind: 'wrong'; word: string; heard?: string }
  | { kind: 'extra'; word: string }

export interface AttemptScore {
  score: number
  correct: number
  total: number
  marks: WordMark[]
}

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function wordsEqual(a: string, b: string): boolean {
  if (a === b) return true
  return fuzzball.ratio(a, b) >= 85
}

export function scoreAttempt(target: string, attempt: string): AttemptScore {
  const tgt = normalizeWords(target)
  const att = normalizeWords(attempt)
  const n = tgt.length
  const m = att.length

  if (n === 0) return { score: 0, correct: 0, total: 0, marks: [] }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = wordsEqual(tgt[i], att[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const marks: WordMark[] = []
  let i = 0
  let j = 0
  let correct = 0
  while (i < n && j < m) {
    if (wordsEqual(tgt[i], att[j])) {
      marks.push({ kind: 'correct', word: tgt[i] })
      correct++
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      marks.push({ kind: 'wrong', word: tgt[i], heard: att[j] })
      i++
    } else {
      marks.push({ kind: 'extra', word: att[j] })
      j++
    }
  }
  while (i < n) marks.push({ kind: 'wrong', word: tgt[i++] })
  while (j < m) marks.push({ kind: 'extra', word: att[j++] })

  return {
    score: Math.round((100 * correct) / n),
    correct,
    total: n,
    marks,
  }
}
