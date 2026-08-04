/**
 * English (AU accent) practice module — API client + scoring.
 *
 * Scoring mirrors the guided-reading philosophy (fuzzy word match via
 * fuzzball, like src/lib/speech.ts) but compares a whole attempt against
 * a whole target using LCS alignment, producing per-word feedback for
 * dictation and shadowing.
 */

import * as fuzzball from "fuzzball";
import { apiFetch } from "./api";

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export interface EnglishLessonListItem {
  id: number;
  title: string;
  slug: string;
  source: "custom" | "youtube";
  level: "beginner" | "intermediate" | "advanced";
  segment_count: number;
}

export interface EnglishSegment {
  id: number;
  order: number;
  text: string;
  audio_url: string;
  duration_s: number;
}

export interface EnglishLessonDetail {
  id: number;
  title: string;
  slug: string;
  source: "custom" | "youtube";
  source_url: string;
  level: string;
  segments: EnglishSegment[];
}

export async function fetchEnglishLessons(): Promise<EnglishLessonListItem[]> {
  const res = await apiFetch("/english/lessons/");
  if (!res.ok) throw new Error(`Gagal memuat lessons (${res.status})`);
  return res.json();
}

export async function fetchEnglishLesson(
  id: number | string
): Promise<EnglishLessonDetail> {
  const res = await apiFetch(`/english/lessons/${id}/`);
  if (!res.ok) throw new Error(`Gagal memuat lesson (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export type WordMark =
  | { kind: "correct"; word: string }
  | { kind: "wrong"; word: string; heard?: string }
  | { kind: "extra"; word: string };

export interface AttemptScore {
  score: number; // 0-100
  correct: number;
  total: number;
  marks: WordMark[]; // target words in order (+ extra words interleaved)
}

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function wordsEqual(a: string, b: string): boolean {
  if (a === b) return true;
  return fuzzball.ratio(a, b) >= 85;
}

/**
 * Compare user's attempt (typed or transcribed) against target text.
 * LCS alignment with fuzzy equality, so "recon" still matches "reckon".
 */
export function scoreAttempt(target: string, attempt: string): AttemptScore {
  const tgt = normalizeWords(target);
  const att = normalizeWords(attempt);
  const n = tgt.length;
  const m = att.length;

  if (n === 0) return { score: 0, correct: 0, total: 0, marks: [] };

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = wordsEqual(tgt[i], att[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Backtrack to build marks
  const marks: WordMark[] = [];
  let i = 0;
  let j = 0;
  let correct = 0;
  while (i < n && j < m) {
    if (wordsEqual(tgt[i], att[j])) {
      marks.push({ kind: "correct", word: tgt[i] });
      correct++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      marks.push({ kind: "wrong", word: tgt[i], heard: att[j] });
      i++;
    } else {
      marks.push({ kind: "extra", word: att[j] });
      j++;
    }
  }
  while (i < n) marks.push({ kind: "wrong", word: tgt[i++] });
  while (j < m) marks.push({ kind: "extra", word: att[j++] });

  return {
    score: Math.round((100 * correct) / n),
    correct,
    total: n,
    marks,
  };
}

/** Reuse the app's star scale (same thresholds as guided reading). */
export function englishStars(score: AttemptScore): number {
  const pct = score.total === 0 ? 0 : score.correct / score.total;
  if (pct >= 0.75) return 4;
  if (pct >= 0.5) return 3;
  if (pct >= 0.25) return 2;
  if (pct > 0) return 1;
  return 0;
}
