import Constants from "expo-constants";
import { fetchChildren, isLoggedIn, pushReadingProgress, pushRewardsBulk, createChildOnServer, pushReadingLog, fetchReadingLog, fetchRewardHistory, fetchReadingProgressFromServer, type DeviceTelemetry } from "./api";
import { upsertChildFromServer, deleteChildrenNotIn, getUnsyncedChildren, linkChildToServer } from "./children";
import { getUnsyncedReadingProgress, getUnsyncedRewards, markRewardsSynced, markReadingProgressSynced, mergeServerRewards, mergeServerReadingProgress, persistIdempotencyKeys, recalculateBalance } from "./rewards";
import { getDeviceId } from "./device";
import { getDatabase, getSetting, setSetting } from "./database";
import { subscribeSession, getSelectedChild } from "./session";

async function gatherTelemetry(): Promise<DeviceTelemetry> {
  const db = await getDatabase();
  const rewardsRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM reward_history WHERE synced = 0"
  );
  const progressRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM reading_progress WHERE synced = 0"
  );
  return {
    device_id: await getDeviceId(),
    app_version: (Constants.expoConfig?.version as string | undefined) ?? "unknown",
    queue_depth_rewards: rewardsRow?.c ?? 0,
    queue_depth_progress: progressRow?.c ?? 0,
    last_successful_sync_at: await getSetting("last_successful_sync_at"),
    last_sync_error: await getSetting("last_sync_error"),
  };
}

export interface SyncReport {
  success: boolean;
  skipped?: boolean;
  notLoggedIn?: boolean;
  // MD-7/AS-1: another device (or admin) invalidated our token — every
  // authed call came back 401. Distinct from notLoggedIn (no token at
  // all) because the queue is NOT cleared and the user just needs to
  // re-authenticate to flush it.
  authExpired?: boolean;
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

// Serialize sync runs instead of dropping concurrent ones. A silent skip
// meant opportunistic pushes could swallow a manual sync triggered right
// after them, leaving the user's latest data unpushed. Queue guarantees
// every caller gets a real run.
let syncChain: Promise<SyncReport> | null = null;

export async function syncAll(childIds?: number[]): Promise<SyncReport> {
  const run = async (): Promise<SyncReport> => {
    const report = emptyReport();
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
    }
    // MD-7/AS-1: if any authed call came back 401, the token got
    // invalidated out-of-band (another device did logoutAllDevices, or
    // admin forced it). Flag the report and persist `auth_state` so the
    // parent page can show a re-login banner. The queue is intentionally
    // left alone — syncRewards/syncReadingProgress/syncReadingLog all
    // bail on error WITHOUT marking rows synced, so relogin + next sync
    // flushes everything.
    const sawAuthError = report.errors.some((e) => /\b401\b/.test(e));
    if (sawAuthError) {
      report.authExpired = true;
      report.success = false;
    }
    // Persist telemetry state so the NEXT push can report ground truth
    // about the device's sync health.
    try {
      if (report.success && !report.notLoggedIn) {
        await setSetting("last_successful_sync_at", new Date().toISOString());
        await setSetting("last_sync_error", "");
        await setSetting("auth_state", "ok");
      } else if (report.authExpired) {
        await setSetting("auth_state", "expired");
        await setSetting(
          "last_sync_error",
          report.errors[report.errors.length - 1] ?? "401"
        );
      } else if (report.errors.length > 0) {
        await setSetting("last_sync_error", report.errors[report.errors.length - 1]);
      }
    } catch {}
    return report;
  };

  const next = syncChain ? syncChain.then(run, run) : run();
  syncChain = next.finally(() => {
    if (syncChain === next) syncChain = null;
  }) as Promise<SyncReport>;
  return next;
}

// Flush the sync queue as soon as connectivity is restored. Without this,
// a user who stayed in the app through a connectivity drop would keep
// queueing data locally until the next AppState foreground transition.
// Only fires on an offline→online edge — the first event is baseline.
export function attachNetInfoReconnectTrigger(): () => void {
  const NetInfo = require("@react-native-community/netinfo").default ?? require("@react-native-community/netinfo");
  let lastOnline: boolean | null = null;
  return NetInfo.addEventListener((state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
    const isOnline = state.isConnected === true && state.isInternetReachable === true;
    if (lastOnline === null) {
      lastOnline = isOnline;
      return;
    }
    if (!lastOnline && isOnline) {
      syncAll().catch(() => {});
    }
    lastOnline = isOnline;
  });
}

// Fire a background sync whenever the active child changes. MC-2: flush
// ALL children, not just the newly-selected one. Profile switch is a
// natural checkpoint, and scoping to the new child would strand the
// previous child's queued rows until mount restart or a NetInfo reconnect.
export function attachSessionSyncTrigger(): () => void {
  let lastId: number | null = getSelectedChild()?.id ?? null;
  return subscribeSession(() => {
    const id = getSelectedChild()?.id ?? null;
    if (id == null || id === lastId) return;
    lastId = id;
    syncAll().catch(() => {});
  });
}

async function syncChildren(childIds: number[] | undefined, report: SyncReport): Promise<void> {
  const callerSuppliedIds = Array.isArray(childIds) && childIds.length > 0;
  // If caller didn't specify children, sync ALL local children.
  // Without this fallback, mount-time syncAll() (no args) would skip push/pull
  // steps entirely — data for every child stays queued forever.
  if (!callerSuppliedIds) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: number }>("SELECT id FROM children");
    childIds = rows.map((r) => r.id);
  }

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

  // MD-4: on a fresh device the local children table is empty when the
  // mount-time syncAll() computes childIds — so the push/pull loops below
  // would skip entirely and the user would see no rewards until they tap
  // a child. Upsert server children first, then re-derive childIds from
  // the freshly populated local table. Only do this when the caller did
  // NOT pass explicit ids, so targeted syncs stay targeted.
  let bootstrappedFromServer = false;
  if (!callerSuppliedIds && serverChildren && childIds && childIds.length === 0) {
    for (const sc of serverChildren) {
      await upsertChildFromServer({ ...sc, coins: undefined as any, stars: undefined as any });
    }
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: number }>("SELECT id FROM children");
    childIds = rows.map((r) => r.id);
    bootstrappedFromServer = true;
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
    // Skip the upsert loop if the bootstrap block above already did it —
    // calling it again would double the upsert count tests rely on.
    if (!bootstrappedFromServer) {
      for (const sc of finalChildren) {
        await upsertChildFromServer({ ...sc, coins: undefined as any, stars: undefined as any });
      }
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

  // Step 5: Pull reading progress from server and merge
  if (childIds && childIds.length > 0) {
    for (const childId of childIds) {
      try {
        const serverProgress = await fetchReadingProgressFromServer(childId);
        if (serverProgress.length > 0) {
          await mergeServerReadingProgress(childId, serverProgress);
        }
      } catch (e) {
        report.errors.push(`pullReadingProgress(${childId}): ${e instanceof Error ? e.message : String(e)}`);
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

    const rewardsWithKeys = unsyncedRewards.map((r) => ({
      type: r.type,
      count: r.count,
      description: r.description,
      created_at: r.created_at,
      idempotency_key: `${deviceId}:${r.id}`,
    }));

    // MC-3: persist idempotency_keys locally BEFORE the push hits the wire.
    // A crash between push-succeeds and markRewardsSynced-completes would
    // otherwise leave rows with synced=0 and no key — mergeServerRewards
    // then can't dedupe them on pull and inserts duplicates.
    const keyMap: Record<number, string> = {};
    unsyncedRewards.forEach((r, i) => {
      keyMap[r.id] = rewardsWithKeys[i].idempotency_key;
    });
    await persistIdempotencyKeys(keyMap);

    // Snapshot telemetry BEFORE marking rows synced so queue depths reflect
    // what was actually pending when the sync began.
    const telemetry = await gatherTelemetry();
    const err = await pushRewardsBulk(childId, rewardsWithKeys, telemetry);

    if (err) {
      // Push failed — DO NOT mark synced
      report.errors.push(err);
      return;
    }

    report.rewardsPushed += unsyncedRewards.length;
    await markRewardsSynced(unsyncedRewards.map((r) => r.id), keyMap);
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
