import { fetchChildren, isLoggedIn, pushReadingProgress, pushRewardsBulk } from "./api";
import { upsertChildFromServer, deleteChildrenNotIn } from "./children";
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
  const serverChildren = await fetchChildren();
  for (const sc of serverChildren) {
    await upsertChildFromServer(sc);
  }
  if (serverChildren.length > 0) {
    await deleteChildrenNotIn(serverChildren.map((c) => c.id));
  }

  // Sync data for each child
  for (const child of serverChildren) {
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
