import { fetchChildren, isLoggedIn, pushReadingProgress, pushRewardsBulk, createChildOnServer } from "./api";
import { upsertChildFromServer, deleteChildrenNotIn, getUnsyncedChildren, linkChildToServer } from "./children";
import { getAllReadingProgress, getUnsyncedRewards, markRewardsSynced } from "./rewards";

let syncing = false;

export async function syncAll(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) return;

    await syncChildren();
  } catch (e) {
    console.warn("syncAll error:", e);
  } finally {
    syncing = false;
  }
}

async function syncChildren(): Promise<void> {
  // Step 1: Push unsynced local children to server
  const unsynced = await getUnsyncedChildren();
  const serverChildren = await fetchChildren();
  const serverIds = new Set(serverChildren.map((c) => c.id));

  for (const local of unsynced) {
    try {
      if (serverIds.has(local.id)) {
        // ID matches a server child — mark as synced without pushing
        await linkChildToServer(local.id, local.id);
      } else {
        // Push to server and remap ID
        const created = await createChildOnServer(local.name, local.age ?? undefined, local.avatar_color);
        await linkChildToServer(local.id, created.id);
      }
    } catch (e) {
      console.warn("pushChild error:", e);
      // Skip this child, retry next sync
    }
  }

  // Step 2: Pull server children (re-fetch after push to get updated list)
  const updatedServerChildren = unsynced.length > 0 ? await fetchChildren() : serverChildren;
  for (const sc of updatedServerChildren) {
    await upsertChildFromServer(sc);
  }
  if (updatedServerChildren.length > 0) {
    await deleteChildrenNotIn(updatedServerChildren.map((c) => c.id));
  }

  // Step 3: Sync data for each child
  for (const child of updatedServerChildren) {
    await syncReadingProgress(child.id);
    await syncRewards(child.id);
  }
}

async function syncReadingProgress(childId: number): Promise<void> {
  try {
    const progress = await getAllReadingProgress(childId);
    for (const [bookId, p] of Object.entries(progress)) {
      await pushReadingProgress(childId, {
        book: bookId,
        last_page: p.lastPage,
        completed: p.completed,
        completed_count: p.completedCount,
      });
    }
  } catch (e) {
    console.warn("syncReadingProgress error:", e);
  }
}

async function syncRewards(childId: number): Promise<void> {
  try {
    const unsynced = await getUnsyncedRewards(childId);
    if (unsynced.length === 0) return;

    await pushRewardsBulk(
      childId,
      unsynced.map((r) => ({
        type: r.type,
        count: r.count,
        description: r.description,
        created_at: r.created_at,
      }))
    );
    await markRewardsSynced(unsynced.map((r) => r.id));
  } catch (e) {
    console.warn("syncRewards error:", e);
  }
}
