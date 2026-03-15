import { getDatabase } from "./database";
import { emitDataChange } from "./db-events";
import type { RewardHistory } from "../types";

export async function addReward(
  childId: number,
  type: "coin" | "star",
  count: number,
  description: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO reward_history (child_id, type, count, description) VALUES (?, ?, ?, ?)`,
    childId,
    type,
    count,
    description
  );
  // Update child totals
  if (type === "coin") {
    await db.runAsync(
      "UPDATE children SET coins = coins + ? WHERE id = ?",
      count,
      childId
    );
  } else {
    await db.runAsync(
      "UPDATE children SET stars = stars + ? WHERE id = ?",
      count,
      childId
    );
  }
  emitDataChange("children");
}

export async function getUnsyncedRewards(
  childId: number
): Promise<{ id: number; type: string; count: number; description: string; created_at: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    "SELECT id, type, count, description, created_at FROM reward_history WHERE child_id = ? AND synced = 0",
    childId
  );
}

export async function markRewardsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE reward_history SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids
  );
}

export async function getRewardHistory(
  childId: number
): Promise<RewardHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    child_id: number;
    type: string;
    count: number;
    description: string;
    created_at: string;
  }>(
    "SELECT * FROM reward_history WHERE child_id = ? ORDER BY created_at DESC",
    childId
  );

  return rows.map((r) => ({
    id: r.id,
    childId: r.child_id,
    type: r.type as "coin" | "star",
    count: r.count,
    description: r.description,
    createdAt: r.created_at,
  }));
}

export async function mergeServerRewards(
  childId: number,
  serverRewards: { type: string; count: number; description: string; created_at: string; idempotency_key: string | null }[]
): Promise<void> {
  const db = await getDatabase();
  for (const r of serverRewards) {
    if (!r.idempotency_key) continue;
    // Skip if already exists locally
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM reward_history WHERE child_id = ? AND idempotency_key = ?",
      childId,
      r.idempotency_key
    );
    if (existing) continue;
    await db.runAsync(
      `INSERT INTO reward_history (child_id, type, count, description, created_at, synced, idempotency_key)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      childId,
      r.type,
      r.count,
      r.description,
      r.created_at,
      r.idempotency_key
    );
  }
}

export async function recalculateBalance(
  childId: number
): Promise<{ coins: number; stars: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ coins: number; stars: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type IN ('coin', 'coin_adjustment') THEN count ELSE 0 END), 0) as coins,
       COALESCE(SUM(CASE WHEN type IN ('star', 'star_adjustment') THEN count ELSE 0 END), 0) as stars
     FROM reward_history WHERE child_id = ?`,
    childId
  );
  const coins = row?.coins ?? 0;
  const stars = row?.stars ?? 0;
  await db.runAsync(
    "UPDATE children SET coins = ?, stars = ? WHERE id = ?",
    coins,
    stars,
    childId
  );
  emitDataChange("children");
  return { coins, stars };
}

export async function saveReadingProgress(
  childId: number,
  bookId: string,
  lastPage: number,
  completed: boolean
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, datetime('now'), 0)
     ON CONFLICT(child_id, book_id) DO UPDATE SET
       last_page = ?,
       completed = ?,
       completed_count = CASE WHEN ? = 1 THEN completed_count + 1 ELSE completed_count END,
       updated_at = datetime('now'),
       synced = 0`,
    childId, bookId, lastPage, completed ? 1 : 0, completed ? 1 : 0,
    lastPage, completed ? 1 : 0, completed ? 1 : 0
  );
  emitDataChange("children");
}

export async function getReadingProgress(
  childId: number,
  bookId: string
): Promise<{ lastPage: number; completed: boolean; completedCount: number } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    last_page: number;
    completed: number;
    completed_count: number;
  }>(
    "SELECT last_page, completed, completed_count FROM reading_progress WHERE child_id = ? AND book_id = ?",
    childId,
    bookId
  );
  if (!row) return null;
  return {
    lastPage: row.last_page,
    completed: row.completed === 1,
    completedCount: row.completed_count,
  };
}

export async function getUnsyncedReadingProgress(
  childId: number
): Promise<Record<string, { lastPage: number; completed: boolean; completedCount: number }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    book_id: string;
    last_page: number;
    completed: number;
    completed_count: number;
  }>(
    "SELECT book_id, last_page, completed, completed_count FROM reading_progress WHERE child_id = ? AND synced = 0",
    childId
  );
  const result: Record<string, { lastPage: number; completed: boolean; completedCount: number }> = {};
  for (const r of rows) {
    result[r.book_id] = {
      lastPage: r.last_page,
      completed: r.completed === 1,
      completedCount: r.completed_count,
    };
  }
  return result;
}

export async function markReadingProgressSynced(
  childId: number,
  bookIds: string[]
): Promise<void> {
  if (bookIds.length === 0) return;
  const db = await getDatabase();
  const placeholders = bookIds.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE reading_progress SET synced = 1 WHERE child_id = ? AND book_id IN (${placeholders})`,
    childId,
    ...bookIds
  );
}

export async function getAllReadingProgress(
  childId: number
): Promise<Record<string, { lastPage: number; completed: boolean; completedCount: number }>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    book_id: string;
    last_page: number;
    completed: number;
    completed_count: number;
  }>(
    "SELECT book_id, last_page, completed, completed_count FROM reading_progress WHERE child_id = ?",
    childId
  );
  const result: Record<string, { lastPage: number; completed: boolean; completedCount: number }> = {};
  for (const r of rows) {
    result[r.book_id] = {
      lastPage: r.last_page,
      completed: r.completed === 1,
      completedCount: r.completed_count,
    };
  }
  return result;
}
