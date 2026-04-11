import { getDatabase } from "./database";
import { emitDataChange } from "./db-events";
import type { RewardHistory } from "../types";

// Fire-and-forget push. Lazy-require sync.ts to break the rewards↔sync cycle.
// The sync guard already skips when a sync is in-flight, so we stay quiet.
function triggerOpportunisticSync(childId: number): void {
  try {
    const { syncAll } = require("./sync") as typeof import("./sync");
    syncAll([childId]).catch(() => {});
  } catch {
    // swallow — opportunistic, must never break the writer
  }
}

export async function addReward(
  childId: number,
  type: "coin" | "star" | "coin_spend" | "coin_adjustment" | "star_adjustment",
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
  // Re-derive children.coins/stars from reward_history in a single statement.
  // Earlier code did `coins = coins + count` which could race with
  // recalculateBalance — both writers would step on each other.
  await db.runAsync(
    `UPDATE children SET
       coins = COALESCE((SELECT SUM(CASE WHEN type IN ('coin', 'coin_adjustment', 'coin_spend') THEN count ELSE 0 END) FROM reward_history WHERE child_id = ?), 0),
       stars = COALESCE((SELECT SUM(CASE WHEN type IN ('star', 'star_adjustment') THEN count ELSE 0 END) FROM reward_history WHERE child_id = ?), 0)
     WHERE id = ?`,
    childId, childId, childId
  );
  emitDataChange("children");
  triggerOpportunisticSync(childId);
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

// Write idempotency_keys for local rows in one atomic statement BEFORE
// the push hits the wire. If the process is killed after push-succeeds
// but before markRewardsSynced completes, the next syncAll's pull step
// (mergeServerRewards) needs these keys present to dedupe — otherwise
// every pending row comes back from the server as a fresh insert and we
// end up with duplicates locally (MC-3).
export async function persistIdempotencyKeys(keyMap: Record<number, string>): Promise<void> {
  const ids = Object.keys(keyMap).map(Number).filter((id) => keyMap[id]);
  if (ids.length === 0) return;
  const db = await getDatabase();
  const caseSql = ids.map(() => "WHEN ? THEN ?").join(" ");
  const inSql = ids.map(() => "?").join(",");
  const params: (number | string)[] = [];
  for (const id of ids) params.push(id, keyMap[id]);
  await db.runAsync(
    `UPDATE reward_history SET idempotency_key = CASE id ${caseSql} END WHERE id IN (${inSql})`,
    ...params,
    ...ids
  );
}

export async function markRewardsSynced(ids: number[], idempotencyKeys?: Record<number, string>): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  if (idempotencyKeys) {
    for (const id of ids) {
      const key = idempotencyKeys[id];
      if (key) {
        await db.runAsync(
          "UPDATE reward_history SET synced = 1, idempotency_key = ? WHERE id = ?",
          key, id
        );
      } else {
        await db.runAsync("UPDATE reward_history SET synced = 1 WHERE id = ?", id);
      }
    }
  } else {
    const placeholders = ids.map(() => "?").join(",");
    await db.runAsync(
      `UPDATE reward_history SET synced = 1 WHERE id IN (${placeholders})`,
      ...ids
    );
  }
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

export async function addAdjustment(
  childId: number,
  type: "coin" | "star",
  targetValue: number
): Promise<number> {
  const db = await getDatabase();
  const adjType = type === "coin" ? "coin_adjustment" : "star_adjustment";
  const sumType = type === "coin" ? "('coin', 'coin_adjustment')" : "('star', 'star_adjustment')";
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(count), 0) as total FROM reward_history WHERE child_id = ? AND type IN ${sumType}`,
    childId
  );
  const current = row?.total ?? 0;
  const delta = targetValue - current;
  if (delta === 0) return 0;
  await db.runAsync(
    `INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (?, ?, ?, ?, 0)`,
    childId,
    adjType,
    delta,
    "Penyesuaian manual"
  );
  // Recalculate balance
  await recalculateBalance(childId);
  return delta;
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
  // Single-statement update: SELECT and UPDATE are fused, so no writer can
  // sneak between reading the sum and writing it back. Previously the two
  // awaits left a gap where an addReward could be overwritten by a stale
  // UPDATE, manifesting as "coins briefly up then snap back".
  await db.runAsync(
    `UPDATE children SET
       coins = COALESCE((SELECT SUM(CASE WHEN type IN ('coin', 'coin_adjustment', 'coin_spend') THEN count ELSE 0 END) FROM reward_history WHERE child_id = ?), 0),
       stars = COALESCE((SELECT SUM(CASE WHEN type IN ('star', 'star_adjustment') THEN count ELSE 0 END) FROM reward_history WHERE child_id = ?), 0)
     WHERE id = ?`,
    childId, childId, childId
  );
  const row = await db.getFirstAsync<{ coins: number; stars: number }>(
    "SELECT coins, stars FROM children WHERE id = ?", childId
  );
  emitDataChange("children");
  return { coins: row?.coins ?? 0, stars: row?.stars ?? 0 };
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
  triggerOpportunisticSync(childId);
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

export async function mergeServerReadingProgress(
  childId: number,
  serverProgress: { book: string; last_page: number; completed: boolean; completed_count: number; updated_at: string }[]
): Promise<void> {
  const db = await getDatabase();
  for (const sp of serverProgress) {
    const bookId = sp.book;
    const local = await db.getFirstAsync<{ last_page: number; completed: number; completed_count: number; updated_at: string }>(
      "SELECT last_page, completed, completed_count, updated_at FROM reading_progress WHERE child_id = ? AND book_id = ?",
      childId, bookId
    );

    if (!local) {
      await db.runAsync(
        `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        childId, bookId, sp.last_page, sp.completed ? 1 : 0, sp.completed_count, sp.updated_at
      );
      continue;
    }

    // Per-field merge instead of LWW: counters move forward only.
    // A server update with a newer timestamp but smaller last_page must not
    // drag the user's furthest page backward (that would be a data loss).
    const mergedLastPage = Math.max(local.last_page, sp.last_page);
    const mergedCount = Math.max(local.completed_count, sp.completed_count);
    const mergedCompleted = (local.completed === 1 || sp.completed) ? 1 : 0;
    const mergedUpdatedAt = sp.updated_at > local.updated_at ? sp.updated_at : local.updated_at;
    const serverMatchesMerged =
      sp.last_page === mergedLastPage &&
      sp.completed_count === mergedCount &&
      (sp.completed ? 1 : 0) === mergedCompleted;

    await db.runAsync(
      `UPDATE reading_progress SET last_page = ?, completed = ?, completed_count = ?, updated_at = ?, synced = ?
       WHERE child_id = ? AND book_id = ?`,
      mergedLastPage, mergedCompleted, mergedCount, mergedUpdatedAt,
      // Stay unsynced if local side still has data the server does not know.
      serverMatchesMerged ? 1 : 0,
      childId, bookId
    );
  }
  emitDataChange("children");
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
