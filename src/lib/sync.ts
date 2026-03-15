import { fetchChildren, isLoggedIn, pushReadingProgress, pushRewardsBulk, createChildOnServer, pushReadingLog, fetchReadingLog, fetchRewardHistory } from "./api";
import { upsertChildFromServer, deleteChildrenNotIn, getUnsyncedChildren, linkChildToServer } from "./children";
import { getUnsyncedReadingProgress, getUnsyncedRewards, markRewardsSynced, markReadingProgressSynced, mergeServerRewards, recalculateBalance } from "./rewards";
import { getDeviceId } from "./device";
import { getDatabase } from "./database";

export interface SyncReport {
  success: boolean;
  skipped?: boolean;
  notLoggedIn?: boolean;
  childrenPushed: number;
  childrenPulled: number;
  rewardsPushed: number;
  progressPushed: number;
  readingLogPushed: number;
  rewardsPulled: number;
  errors: string[];
}

function emptyReport(): SyncReport {
  return {
    success: true,
    childrenPushed: 0,
    childrenPulled: 0,
    rewardsPushed: 0,
    progressPushed: 0,
    readingLogPushed: 0,
    rewardsPulled: 0,
    errors: [],
  };
}

let syncing = false;

export async function syncAll(childIds?: number[]): Promise<SyncReport> {
  const report = emptyReport();
  if (syncing) {
    report.skipped = true;
    return report;
  }
  syncing = true;
  try {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      report.notLoggedIn = true;
      report.success = false;
      return report;
    }

    await syncChildren(childIds, report);
    if (report.errors.length > 0) report.success = false;
  } catch (e) {
    report.errors.push(`syncAll: ${e instanceof Error ? e.message : String(e)}`);
    report.success = false;
  } finally {
    syncing = false;
  }
  return report;
}

async function syncChildren(childIds: number[] | undefined, report: SyncReport): Promise<void> {
  // Step 1: Push unsynced local children to server
  const unsynced = await getUnsyncedChildren();
  let serverChildren;
  try {
    serverChildren = await fetchChildren();
  } catch (e) {
    report.errors.push(`fetchChildren: ${e instanceof Error ? e.message : String(e)}`);
    // Cannot continue without server children list — but still try push data
    serverChildren = null;
  }

  if (serverChildren) {
    const serverIds = new Set(serverChildren.map((c) => c.id));
    for (const local of unsynced) {
      try {
        if (serverIds.has(local.id)) {
          await linkChildToServer(local.id, local.id);
        } else {
          const created = await createChildOnServer(local.name, local.age ?? undefined, local.avatar_color);
          await linkChildToServer(local.id, created.id);
        }
        report.childrenPushed++;
      } catch (e) {
        report.errors.push(`pushChild(${local.name}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Step 2: Push data for each child (push-first)
  if (childIds && childIds.length > 0) {
    for (const childId of childIds) {
      await syncRewards(childId, report);
      await syncReadingProgress(childId, report);
      await syncReadingLog(childId, report);
    }
  }

  // Step 3: Pull server children (re-fetch if we pushed data or children)
  if (serverChildren) {
    const needRefetch = unsynced.length > 0 || (childIds && childIds.length > 0);
    const finalChildren = needRefetch ? await fetchChildren() : serverChildren;
    report.childrenPulled = finalChildren.length;
    for (const sc of finalChildren) {
      await upsertChildFromServer({ ...sc, coins: undefined as any, stars: undefined as any });
    }
    if (finalChildren.length > 0) {
      await deleteChildrenNotIn(finalChildren.map((c) => c.id));
    }
  }

  // Step 4: Pull reward history and recalculate balance for each child
  if (childIds && childIds.length > 0) {
    for (const childId of childIds) {
      try {
        const serverRewards = await fetchRewardHistory(childId);
        report.rewardsPulled += serverRewards.length;
        await mergeServerRewards(childId, serverRewards);
        await recalculateBalance(childId);
      } catch (e) {
        report.errors.push(`pullRewards(${childId}): ${e instanceof Error ? e.message : String(e)}`);
        // DO NOT recalculate — would reset coins from incomplete data
      }
    }
  }
}

async function syncReadingProgress(childId: number, report: SyncReport): Promise<void> {
  try {
    const progress = await getUnsyncedReadingProgress(childId);
    const bookIds = Object.keys(progress);
    if (bookIds.length === 0) return;

    const failedBooks: string[] = [];
    const succeededBooks: string[] = [];

    for (const [bookId, p] of Object.entries(progress)) {
      try {
        const err = await pushReadingProgress(childId, {
          book: bookId,
          last_page: p.lastPage,
          completed: p.completed,
          completed_count: p.completedCount,
        });
        if (err) {
          report.errors.push(err);
          failedBooks.push(bookId);
        } else {
          succeededBooks.push(bookId);
          report.progressPushed++;
        }
      } catch (e) {
        report.errors.push(`pushProgress(${bookId}): ${e instanceof Error ? e.message : String(e)}`);
        failedBooks.push(bookId);
      }
    }
    // Only mark succeeded books as synced
    if (succeededBooks.length > 0) {
      await markReadingProgressSynced(childId, succeededBooks);
    }
  } catch (e) {
    report.errors.push(`syncReadingProgress(${childId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function syncRewards(childId: number, report: SyncReport): Promise<void> {
  try {
    const unsyncedRewards = await getUnsyncedRewards(childId);
    if (unsyncedRewards.length === 0) return;

    const deviceId = await getDeviceId();

    const err = await pushRewardsBulk(
      childId,
      unsyncedRewards.map((r) => ({
        type: r.type,
        count: r.count,
        description: r.description,
        created_at: r.created_at,
        idempotency_key: `${deviceId}:${r.id}`,
      }))
    );

    if (err) {
      // Push failed — DO NOT mark synced
      report.errors.push(err);
      return;
    }

    report.rewardsPushed += unsyncedRewards.length;
    await markRewardsSynced(unsyncedRewards.map((r) => r.id));
  } catch (e) {
    // Network error or other — DO NOT mark synced
    report.errors.push(`syncRewards(${childId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function syncReadingLog(childId: number, report: SyncReport): Promise<void> {
  try {
    const db = await getDatabase();
    const deviceId = await getDeviceId();

    // Push unsynced entries
    const unsynced = await db.getAllAsync<{ id: number; book_id: string; completed_at: string }>(
      "SELECT id, book_id, completed_at FROM reading_log WHERE child_id = ? AND synced = 0",
      childId
    );

    if (unsynced.length > 0) {
      const err = await pushReadingLog(
        childId,
        unsynced.map(r => ({
          book_id: r.book_id,
          completed_at: r.completed_at,
          idempotency_key: `${deviceId}:rl:${r.id}`,
        }))
      );

      if (err) {
        report.errors.push(err);
        // DO NOT mark synced
      } else {
        report.readingLogPushed += unsynced.length;
        const ids = unsynced.map(r => r.id);
        await db.runAsync(
          `UPDATE reading_log SET synced = 1 WHERE id IN (${ids.map(() => "?").join(",")})`,
          ...ids
        );
      }
    }

    // Pull from server and merge
    const serverEntries = await fetchReadingLog(childId);
    for (const entry of serverEntries) {
      if (!entry.idempotency_key) continue;
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
    report.errors.push(`syncReadingLog(${childId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}
