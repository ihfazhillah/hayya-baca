import { fetchChildren, isLoggedIn, pushReadingProgress, pushRewardsBulk, createChildOnServer } from "./api";
import { upsertChildFromServer, deleteChildrenNotIn, getUnsyncedChildren, linkChildToServer } from "./children";
import { getUnsyncedReadingProgress, getUnsyncedRewards, markRewardsSynced, markReadingProgressSynced } from "./rewards";
import { getDeviceId } from "./device";

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
      didPush = true;
    } catch (e) {
      console.warn("syncActiveChild error:", e);
    }
  }

  // Step 3: Pull server children (re-fetch if we pushed data or children)
  const finalChildren = (unsynced.length > 0 || didPush) ? await fetchChildren() : serverChildren;
  for (const sc of finalChildren) {
    await upsertChildFromServer(sc);
  }
  if (finalChildren.length > 0) {
    await deleteChildrenNotIn(finalChildren.map((c) => c.id));
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
