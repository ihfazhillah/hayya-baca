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

// Whisper often expands contractions ("you'll"→"you will") and writes numbers
// as digits ("three"→"3"). Canonicalize BOTH the reference and the transcript
// so a correct utterance isn't marked wrong. Possessive 's and ambiguous 'd
// (he'd = had/would) are left untouched on purpose.
const CONTRACTIONS: Record<string, string> = {
  "won't": 'will not',
  "can't": 'can not',
  cannot: 'can not',
  "shan't": 'shall not',
  "let's": 'let us',
  "it's": 'it is',
  "that's": 'that is',
  "he's": 'he is',
  "she's": 'she is',
  "what's": 'what is',
  "who's": 'who is',
  "here's": 'here is',
  "there's": 'there is',
  "i'm": 'i am',
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17',
  eighteen: '18', nineteen: '19', twenty: '20', thirty: '30', forty: '40',
  fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
}

/** Expand one token to its canonical form(s). */
function canonToken(tok: string): string[] {
  if (CONTRACTIONS[tok]) return CONTRACTIONS[tok].split(' ')
  if (NUMBER_WORDS[tok]) return [NUMBER_WORDS[tok]]
  if (tok.length > 3 && tok.endsWith("n't")) return [tok.slice(0, -3), 'not']
  if (tok.length > 3 && tok.endsWith("'ll")) return [tok.slice(0, -3), 'will']
  if (tok.length > 3 && tok.endsWith("'re")) return [tok.slice(0, -3), 'are']
  if (tok.length > 3 && tok.endsWith("'ve")) return [tok.slice(0, -3), 'have']
  if (tok.length > 2 && tok.endsWith("'m")) return [tok.slice(0, -2), 'am']
  return [tok]
}

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'") // curly ’ ‘ → straight ' (regex strips others)
    .replace(/%/g, ' percent ') // "80%" ↔ "eighty percent"
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .flatMap(canonToken)
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

  // dp[i][j] = max target tokens matched from tgt[i..], att[j..]. Besides the
  // single fuzzy match, allow EXACT compound merges (one target token = two
  // attempt tokens, or vice-versa) so Whisper's spacing of "data set"/"dataset",
  // "any time"/"anytime", "re run"/"rerun" doesn't wrongly count as a miss.
  // Merges are exact-only: fuzzy concatenation over-credits unrelated words.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      let best = Math.max(dp[i + 1][j], dp[i][j + 1])
      if (wordsEqual(tgt[i], att[j])) best = Math.max(best, 1 + dp[i + 1][j + 1])
      if (j + 1 < m && tgt[i] === att[j] + att[j + 1])
        best = Math.max(best, 1 + dp[i + 1][j + 2])
      if (i + 1 < n && tgt[i] + tgt[i + 1] === att[j])
        best = Math.max(best, 2 + dp[i + 2][j + 1])
      dp[i][j] = best
    }
  }

  const marks: WordMark[] = []
  let i = 0
  let j = 0
  let correct = 0
  while (i < n && j < m) {
    const cur = dp[i][j]
    if (wordsEqual(tgt[i], att[j]) && cur === 1 + dp[i + 1][j + 1]) {
      marks.push({ kind: 'correct', word: tgt[i] })
      correct++
      i++
      j++
    } else if (
      j + 1 < m &&
      tgt[i] === att[j] + att[j + 1] &&
      cur === 1 + dp[i + 1][j + 2]
    ) {
      marks.push({ kind: 'correct', word: tgt[i] })
      correct++
      i++
      j += 2
    } else if (
      i + 1 < n &&
      tgt[i] + tgt[i + 1] === att[j] &&
      cur === 2 + dp[i + 2][j + 1]
    ) {
      marks.push({ kind: 'correct', word: tgt[i] })
      marks.push({ kind: 'correct', word: tgt[i + 1] })
      correct += 2
      i += 2
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
