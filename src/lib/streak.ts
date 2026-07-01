import { getDatabase, getSetting, setSetting } from "./database";
import { emitDataChange } from "./db-events";
import type { StreakDailyLog, StreakStatus } from "../types";

// Helper: format a Date to YYYY-MM-DD in local timezone
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Normalize ISO datetime to date string (YYYY-MM-DD) in local time
function toDateString(iso: string): string {
  return toLocalDateString(new Date(iso));
}

export function today(): string {
  return toLocalDateString(new Date());
}

export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
}


// Backend (Indonesian) to Frontend (English) badge level mapping
const BACKEND_BADGE_MAP: Record<string, string> = {
  benih: "seed",
  tunas_hijau: "sprout",
  kuncup_merah: "bud",
  strawberry_muda: "young",
  strawberry_manis: "ripe",
  strawbarry_raksasa: "giant", // backend typo preserved
  strawberry_raksasa: "giant",
};

/**
 * Map backend badge level (Indonesian) to frontend key (English).
 * Returns input unchanged if already an English key.
 */
export function mapBadgeLevel(raw: string): string {
  return BACKEND_BADGE_MAP[raw] ?? raw;
}

/**
 * Store server-provided grace period end date in settings table.
 */
export async function setGracePeriodEndDate(
  childId: number,
  graceActive: boolean,
  gracePeriodEndDate: string | null,
  graceDaysRemaining: number | null = null
): Promise<void> {
  await setSetting(`grace_${childId}`, JSON.stringify({ graceActive, gracePeriodEndDate, graceDaysRemaining }));
}

/**
 * Retrieve stored grace period state from settings table.
 */
export async function getGracePeriodState(
  childId: number
): Promise<{ graceActive: boolean; gracePeriodEndDate: string | null; graceDaysRemaining: number | null } | null> {
  const val = await getSetting(`grace_${childId}`);
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * Store server-provided badge level in settings table.
 * This is the source of truth for badge level — local calculation is fallback only.
 */
export async function setServerBadgeLevel(
  childId: number,
  badgeLevel: string
): Promise<void> {
  await setSetting(`badge_${childId}`, badgeLevel);
}

/**
 * Retrieve stored server badge level from settings table.
 */
export async function getServerBadgeLevel(
  childId: number
): Promise<string | null> {
  return await getSetting(`badge_${childId}`);
}

/**
 * Store server-provided computed streak values in settings table.
 * These serve as the base/fallback when local logs are empty (e.g. new device).
 */
export async function setServerStreakValues(
  childId: number,
  currentStreak: number,
  longestStreak: number,
  lastReadingDate: string | null
): Promise<void> {
  await setSetting(
    `server_streak_${childId}`,
    JSON.stringify({ currentStreak, longestStreak, lastReadingDate })
  );
}

/**
 * Retrieve stored server streak values from settings table.
 */
export async function getServerStreakValues(
  childId: number
): Promise<{ currentStreak: number; longestStreak: number; lastReadingDate: string | null } | null> {
  const val = await getSetting(`server_streak_${childId}`);
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

// Badge levels based on streak count — 6 strawberry growth stages
function getBadgeLevel(streak: number): "none" | "seed" | "sprout" | "bud" | "young" | "ripe" | "giant" {
  if (streak >= 60) return "giant";
  if (streak >= 30) return "ripe";
  if (streak >= 14) return "young";
  if (streak >= 7) return "bud";
  if (streak >= 3) return "sprout";
  if (streak >= 1) return "seed";
  return "none";
}

// --- Database operations ---

export async function recordDailyReading(
  childId: number,
  contentId: string,
  contentType: 'book' | 'article' = 'book'
): Promise<void> {
  const db = await getDatabase();
  const ts = new Date().toISOString();

  // Upsert: one log per child per day (contentId updated if they read multiple)
  await db.runAsync(
    `INSERT INTO streak_daily_logs (child_id, content_type, content_id, completed_at, synced)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(child_id, completed_at) DO UPDATE SET content_id = excluded.content_id, content_type = excluded.content_type`,
    childId,
    contentType,
    contentId,
    ts
  );

  emitDataChange("streak");
}

export async function getUnsyncedStreaks(
  childId: number
): Promise<StreakDailyLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    child_id: number;
    content_type: string;
    content_id: string;
    completed_at: string;
    synced: number;
  }>(
    "SELECT id, child_id, content_type, content_id, completed_at, synced FROM streak_daily_logs WHERE child_id = ? AND synced = 0",
    childId
  );

  return rows.map((r) => ({
    id: r.id,
    childId: r.child_id,
    contentType: (r.content_type === 'article' ? 'article' : 'book') as 'book' | 'article',
    contentId: r.content_id,
    completedAt: toDateString(r.completed_at),
    synced: r.synced === 1,
  }));
}

export async function markStreaksSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE streak_daily_logs SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids
  );
}

// --- Streak calculation ---

export async function getStreakStatus(childId: number): Promise<StreakStatus> {
  const db = await getDatabase();

  // Get all distinct dates the child has read
  const rows = await db.getAllAsync<{ completed_at: string }>(
    "SELECT DISTINCT date(completed_at) as completed_at FROM streak_daily_logs WHERE child_id = ? ORDER BY completed_at DESC",
    childId
  );

  const dates = rows.map((r) => toDateString(r.completed_at)).sort().reverse();

  // Fetch server-provided state in parallel (grace, badge, computed streak values)
  const [serverGrace, serverStreak, serverBadge] = await Promise.all([
    getGracePeriodState(childId),
    getServerStreakValues(childId),
    getServerBadgeLevel(childId),
  ]);

  // NEW DEVICE PATH: no local logs — use server values as base
  if (dates.length === 0) {
    if (serverStreak) {
      // Server has computed streak — use as base
      const todayStr = today();
      let currentStreak = serverStreak.currentStreak;
      let graceActive = false;

      // Check if grace period still valid
      if (serverGrace?.graceActive && serverGrace.gracePeriodEndDate) {
        const endDate = serverGrace.gracePeriodEndDate.substring(0, 10);
        if (todayStr <= endDate) {
          graceActive = true;
        } else {
          // Grace expired — streak resets
          currentStreak = 0;
        }
      } else if (serverStreak.lastReadingDate) {
        const lastDate = serverStreak.lastReadingDate.substring(0, 10);
        const yesterdayStr = yesterday();
        if (lastDate !== todayStr && lastDate !== yesterdayStr) {
          // Last reading was more than 1 day ago and no active grace — reset
          currentStreak = 0;
        }
      } else if (!serverStreak.lastReadingDate) {
        // Never read — streak stays 0
        currentStreak = 0;
      }

      const badgeLevel = serverBadge
        ? mapBadgeLevel(serverBadge)
        : getBadgeLevel(currentStreak);

      return {
        currentStreak,
        longestStreak: serverStreak.longestStreak,
        lastReadingDate: serverStreak.lastReadingDate?.substring(0, 10) ?? null,
        graceActive,
        gracePeriodEndDate: serverGrace?.gracePeriodEndDate ?? null,
        graceDaysRemaining: serverGrace?.graceDaysRemaining ?? null,
        badgeLevel,
      };
    }

    // No server data either — truly empty
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastReadingDate: null,
      graceActive: false,
      graceDaysRemaining: null,
      badgeLevel: "none",
    };
  }

  // LOCAL DATA PATH: compute from local logs, merge with server base
  const todayStr = today();
  const yesterdayStr = yesterday();
  const lastDate = dates[0];

  let currentStreak = 0;
  let graceActive = false;

  if (lastDate === todayStr) {
    // Read today - count consecutive days backward from today
    currentStreak = countConsecutive(dates, todayStr);
  } else if (lastDate === yesterdayStr) {
    // Read yesterday - grace period active, streak preserved until today
    graceActive = true;
    currentStreak = countConsecutive(dates, yesterdayStr);
  } else {
    // Check server-provided grace period (3 days vs local 1-day check)
    if (serverGrace && serverGrace.graceActive && serverGrace.gracePeriodEndDate) {
      const endDate = serverGrace.gracePeriodEndDate.substring(0, 10);
      if (todayStr <= endDate) {
        // Server says grace is still active — preserve streak
        graceActive = true;
        // Count consecutive from the last reading date
        currentStreak = countConsecutive(dates, lastDate);
      } else {
        // Grace period expired
        currentStreak = 0;
        graceActive = false;
      }
    } else {
      // No server grace data — fallback to local 1-day check
      currentStreak = 0;
      graceActive = false;
    }
  }

  // Merge with server base: local calc may be lower on new device (partial
  // logs not yet synced). Use max of both to avoid showing reduced streak.
  if (serverStreak && serverStreak.currentStreak > currentStreak) {
    currentStreak = serverStreak.currentStreak;
  }

  // Calculate longest streak from local, merge with server
  const localLongest = calculateLongestStreak(dates);
  const longestStreak = serverStreak
    ? Math.max(localLongest, serverStreak.longestStreak)
    : localLongest;

  // Use server-provided badge level as source of truth.
  // Fall back to local calculation only if no server data available.
  const badgeLevel = serverBadge
    ? mapBadgeLevel(serverBadge)
    : getBadgeLevel(currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastReadingDate: lastDate,
    graceActive,
    gracePeriodEndDate: serverGrace?.gracePeriodEndDate ?? null,
    graceDaysRemaining: serverGrace?.graceDaysRemaining ?? null,
    badgeLevel,
  };
}

// Count consecutive days backward from startDay
function countConsecutive(dates: string[], startDay: string): number {
  const dateSet = new Set(dates);
  let count = 0;
  const cursor = new Date(startDay);

  while (dateSet.has(toLocalDateString(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return count;
}

// Find longest consecutive streak in the date history
function calculateLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
    // diffDays <= 0 means duplicate - skip
  }

  return maxStreak;
}
