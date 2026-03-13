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

export async function saveReadingProgress(
  childId: number,
  bookId: string,
  lastPage: number,
  completed: boolean
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(child_id, book_id) DO UPDATE SET
       last_page = ?,
       completed = ?,
       completed_count = CASE WHEN ? = 1 THEN completed_count + 1 ELSE completed_count END,
       updated_at = datetime('now')`,
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
