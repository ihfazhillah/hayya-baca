import { fetchChildren, isLoggedIn, pushReadingProgress, pushRewardsBulk, createChildOnServer, pushReadingLog, fetchReadingLog, fetchRewardHistory } from "./api";
import { upsertChildFromServer, deleteChildrenNotIn, getUnsyncedChildren, linkChildToServer } from "./children";
import { getUnsyncedReadingProgress, getUnsyncedRewards, markRewardsSynced, markReadingProgressSynced, mergeServerRewards, recalculateBalance } from "./rewards";
import { getDeviceId } from "./device";
import { getDatabase } from "./database";

let syncing = false;

export async function syncAll(activeChildId?: number): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) return;

    await syncChildren(activeChildId);
  } catch (e) {
    console.warn("syncAll error:", e);
  } finally {
    syncing = false;
  }
}

async function syncChildren(activeChildId?: number): Promise<void> {
  // Step 1: Push unsynced local children to server
  const unsynced = await getUnsyncedChildren();
  const serverChildren = await fetchChildren();
  const serverIds = new Set(serverChildren.map((c) => c.id));

  for (const local of unsynced) {
    try {
      if (serverIds.has(local.id)) {
        await linkChildToServer(local.id, local.id);
      } else {
        const created = await createChildOnServer(local.name, local.age ?? undefined, local.avatar_color);
        await linkChildToServer(local.id, created.id);
      }
    } catch (e) {
      console.warn("pushChild error:", e);
    }
  }

  // Step 2: Push data for active child BEFORE pulling (push-first)
  let didPush = false;
  if (activeChildId) {
    try {
      await syncRewards(activeChildId);
      await syncReadingProgress(activeChildId);
      await syncReadingLog(activeChildId);
      didPush = true;
    } catch (e) {
      console.warn("syncActiveChild error:", e);
    }
  }

  // Step 3: Pull server children (re-fetch if we pushed data or children)
  const finalChildren = (unsynced.length > 0 || didPush) ? await fetchChildren() : serverChildren;
  for (const sc of finalChildren) {
    // Don't overwrite coins/stars — they'll be recalculated from reward_history
    await upsertChildFromServer({ ...sc, coins: undefined as any, stars: undefined as any });
  }
  if (finalChildren.length > 0) {
    await deleteChildrenNotIn(finalChildren.map((c) => c.id));
  }

  // Step 4: Pull reward history and recalculate balance
  if (activeChildId) {
    try {
      const serverRewards = await fetchRewardHistory(activeChildId);
      await mergeServerRewards(activeChildId, serverRewards);
      await recalculateBalance(activeChildId);
    } catch (e) {
      console.warn("syncRewardHistory error:", e);
    }
  }
}

async function syncReadingProgress(childId: number): Promise<void> {
  try {
    const progress = await getUnsyncedReadingProgress(childId);
    const bookIds = Object.keys(progress);
    if (bookIds.length === 0) return;

    for (const [bookId, p] of Object.entries(progress)) {
      await pushReadingProgress(childId, {
        book: bookId,
        last_page: p.lastPage,
        completed: p.completed,
        completed_count: p.completedCount,
      });
    }
    await markReadingProgressSynced(childId, bookIds);
  } catch (e) {
    console.warn("syncReadingProgress error:", e);
  }
}

async function syncRewards(childId: number): Promise<void> {
  try {
    const unsyncedRewards = await getUnsyncedRewards(childId);
    if (unsyncedRewards.length === 0) return;

    const deviceId = await getDeviceId();

    await pushRewardsBulk(
      childId,
      unsyncedRewards.map((r) => ({
        type: r.type,
        count: r.count,
        description: r.description,
        created_at: r.created_at,
        idempotency_key: `${deviceId}:${r.id}`,
      }))
    );
    await markRewardsSynced(unsyncedRewards.map((r) => r.id));
  } catch (e) {
    console.warn("syncRewards error:", e);
  }
}

async function syncReadingLog(childId: number): Promise<void> {
  try {
    const db = await getDatabase();
    const deviceId = await getDeviceId();

    // Push unsynced entries
    const unsynced = await db.getAllAsync<{ id: number; book_id: string; completed_at: string }>(
      "SELECT id, book_id, completed_at FROM reading_log WHERE child_id = ? AND synced = 0",
      childId
    );

    if (unsynced.length > 0) {
      await pushReadingLog(
        childId,
        unsynced.map(r => ({
          book_id: r.book_id,
          completed_at: r.completed_at,
          idempotency_key: `${deviceId}:rl:${r.id}`,
        }))
      );
      const ids = unsynced.map(r => r.id);
      await db.runAsync(
        `UPDATE reading_log SET synced = 1 WHERE id IN (${ids.map(() => "?").join(",")})`,
        ...ids
      );
    }

    // Pull from server and merge
    const serverEntries = await fetchReadingLog(childId);
    for (const entry of serverEntries) {
      if (!entry.idempotency_key) continue;
      // Skip if already exists locally (by idempotency_key check via book_id + completed_at)
      const existing = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM reading_log WHERE child_id = ? AND book_id = ? AND completed_at = ?",
        childId, entry.book_id, entry.completed_at
      );
      if (!existing) {
        await db.runAsync(
          "INSERT INTO reading_log (child_id, book_id, completed_at, synced) VALUES (?, ?, ?, 1)",
          childId, entry.book_id, entry.completed_at
        );
      }
    }
  } catch (e) {
    console.warn("syncReadingLog error:", e);
  }
}
