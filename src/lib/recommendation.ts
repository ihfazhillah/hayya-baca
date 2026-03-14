import { getDatabase } from "./database";

/**
 * Append a reading log entry when a book/article is completed.
 */
export async function appendReadingLog(childId: number, bookId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO reading_log (child_id, book_id) VALUES (?, ?)",
    childId, bookId
  );
}

/**
 * Compute which books are locked for a child.
 * Lock: 3 consecutive same book_id in reading_log.
 * Unlock: 3 distinct different book_ids read after the streak.
 * Parent unlock: __unlock:{slug} entry breaks the lock.
 * Guard: unlocked must remain >= 3.
 */
export async function getLockedBooks(childId: number, totalContent: number): Promise<Set<string>> {
  if (totalContent < 5) return new Set();

  const db = await getDatabase();
  const rows = await db.getAllAsync<{ book_id: string; completed_at: string }>(
    "SELECT book_id, completed_at FROM reading_log WHERE child_id = ? ORDER BY completed_at DESC",
    childId
  );

  // Find all streaks of 3+ consecutive same book_id
  // and check if they've been unlocked
  const locked = new Set<string>();
  const unlocked = new Set<string>(); // books that were locked but unlocked

  let i = 0;
  while (i < rows.length) {
    const bookId = rows[i].book_id;

    // Skip unlock markers
    if (bookId.startsWith("__unlock:")) {
      i++;
      continue;
    }

    // Check for streak of 3
    let streakLen = 1;
    let j = i + 1;
    while (j < rows.length && rows[j].book_id === bookId) {
      streakLen++;
      j++;
    }

    if (streakLen >= 3) {
      // Check for parent unlock override before this streak
      const unlockMarker = `__unlock:${bookId}`;
      let hasUnlockOverride = false;
      for (let k = 0; k < i; k++) {
        if (rows[k].book_id === unlockMarker) {
          hasUnlockOverride = true;
          break;
        }
      }

      if (hasUnlockOverride) {
        unlocked.add(bookId);
      } else {
        // Count distinct books read after this streak (before this streak in the DESC array = indices 0..i-1)
        const distinctAfter = new Set<string>();
        for (let k = 0; k < i; k++) {
          const rid = rows[k].book_id;
          if (!rid.startsWith("__unlock:") && rid !== bookId && !locked.has(rid)) {
            distinctAfter.add(rid);
          }
        }

        if (distinctAfter.size >= 3) {
          unlocked.add(bookId);
        } else {
          // Guard: check if locking this would leave < 3 unlocked
          const wouldBeLocked = locked.size + 1;
          const wouldBeUnlocked = totalContent - wouldBeLocked;
          if (wouldBeUnlocked >= 3) {
            locked.add(bookId);
          }
        }
      }
    }

    i = j;
  }

  return locked;
}

/**
 * Get unlock progress: how many more distinct reads needed to unlock a book.
 */
export async function getUnlockProgress(childId: number, bookId: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ book_id: string; completed_at: string }>(
    "SELECT book_id, completed_at FROM reading_log WHERE child_id = ? ORDER BY completed_at DESC",
    childId
  );

  // Find the streak for this bookId
  let streakEnd = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].book_id === bookId) {
      let count = 1;
      let j = i + 1;
      while (j < rows.length && rows[j].book_id === bookId) {
        count++;
        j++;
      }
      if (count >= 3) {
        streakEnd = i; // streak starts at index i in DESC order
        break;
      }
    }
  }

  if (streakEnd === -1) return 0; // not locked

  // Count distinct reads before the streak (indices 0..streakEnd-1 in DESC = after in time)
  const distinctAfter = new Set<string>();
  for (let k = 0; k < streakEnd; k++) {
    const rid = rows[k].book_id;
    if (!rid.startsWith("__unlock:") && rid !== bookId) {
      distinctAfter.add(rid);
    }
  }

  return Math.max(0, 3 - distinctAfter.size);
}

interface BookForSort {
  id: string;
  title: string;
  coverPath: string | null;
  pageCount: number;
  hasAudio: boolean;
}

/**
 * Sort books for display:
 * 1. In-progress (started but not completed)
 * 2. Unread (no progress)
 * 3. Completed (sorted by completedCount ascending)
 * 4. Locked (last)
 */
export function sortForDisplay(
  books: BookForSort[],
  progress: Record<string, { lastPage: number; completed: boolean; completedCount: number }>,
  lockedSet: Set<string>
): BookForSort[] {
  return [...books].sort((a, b) => {
    const pa = progress[a.id];
    const pb = progress[b.id];
    const la = lockedSet.has(a.id);
    const lb = lockedSet.has(b.id);

    const prioA = getPriority(pa, la);
    const prioB = getPriority(pb, lb);

    if (prioA !== prioB) return prioA - prioB;

    // Within completed category, sort by completedCount ascending
    if (prioA === 2 && prioB === 2) {
      return (pa?.completedCount ?? 0) - (pb?.completedCount ?? 0);
    }

    return 0;
  });
}

function getPriority(
  p: { lastPage: number; completed: boolean; completedCount: number } | undefined,
  locked: boolean
): number {
  if (locked) return 3;
  if (!p) return 1; // unread
  if (!p.completed && p.lastPage > 0) return 0; // in-progress
  if (p.completed) return 2; // completed
  return 1; // no progress
}

interface BookWithCategories extends BookForSort {
  categories?: string[];
}

/**
 * Get similar books by shared categories.
 */
export function getSimilarBooks(bookId: string, allBooks: BookWithCategories[]): BookWithCategories[] {
  const book = allBooks.find(b => b.id === bookId);
  if (!book?.categories?.length) return [];

  const cats = new Set(book.categories);
  return allBooks.filter(b =>
    b.id !== bookId &&
    b.categories?.some(c => cats.has(c))
  );
}

/**
 * Get content IDs that haven't been seen yet.
 */
export async function getNewContentIds(childId: number, allContentIds: string[]): Promise<string[]> {
  const db = await getDatabase();
  const seenRows = await db.getAllAsync<{ content_id: string }>(
    "SELECT content_id FROM seen_content WHERE child_id = ?",
    childId
  );
  const seenSet = new Set(seenRows.map(r => r.content_id));
  return allContentIds.filter(id => !seenSet.has(id));
}

/**
 * Mark content as seen.
 */
export async function markContentSeen(childId: number, contentId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR IGNORE INTO seen_content (child_id, content_id) VALUES (?, ?)",
    childId, contentId
  );
}
