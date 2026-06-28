import { getDatabase } from "./database";
import { emitDataChange } from "./db-events";
import type { StreakDailyLog, StreakStatus } from "../types";

// Normalize ISO datetime to date string (YYYY-MM-DD) in local time
function toDateString(iso: string): string {
  return iso.substring(0, 10);
}

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().substring(0, 10);
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
  contentId: string
): Promise<void> {
  const db = await getDatabase();
  const ts = new Date().toISOString();

  // Upsert: one log per child per day (contentId updated if they read multiple)
  await db.runAsync(
    `INSERT INTO streak_daily_logs (child_id, content_id, completed_at, synced)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(child_id, completed_at) DO UPDATE SET content_id = excluded.content_id`,
    childId,
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
    content_id: string;
    completed_at: string;
    synced: number;
  }>(
    "SELECT id, child_id, content_id, completed_at, synced FROM streak_daily_logs WHERE child_id = ? AND synced = 0",
    childId
  );

  return rows.map((r) => ({
    id: r.id,
    childId: r.child_id,
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

  if (dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastReadingDate: null,
      graceActive: false,
      badgeLevel: "none",
    };
  }

  // Calculate current streak
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
    // Missed both today and yesterday - streak broken
    currentStreak = 0;
    graceActive = false;
  }

  // Calculate longest streak
  const longestStreak = calculateLongestStreak(dates);

  return {
    currentStreak,
    longestStreak,
    lastReadingDate: lastDate,
    graceActive,
    badgeLevel: getBadgeLevel(currentStreak),
  };
}

// Count consecutive days backward from startDay
function countConsecutive(dates: string[], startDay: string): number {
  const dateSet = new Set(dates);
  let count = 0;
  const cursor = new Date(startDay);

  while (dateSet.has(cursor.toISOString().substring(0, 10))) {
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
