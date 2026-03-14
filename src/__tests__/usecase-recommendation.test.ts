/**
 * Use case: Rekomendasi, lock, dan sorting buku
 *
 * 1. 3x baca buku sama berturut-turut → buku di-lock
 * 2. 3x baca artikel sama → artikel di-lock
 * 3. Total konten < 5 → tidak lock
 * 4. Baca 3 konten berbeda setelah lock → unlock
 * 5. Multiple locks diperbolehkan, asal unlocked >= 3
 * 6. Guard: stop locking kalau unlocked < 3
 * 7. Parent unlock: override lock
 * 8. Sort: in-progress > belum dibaca > sering dibaca > locked
 * 9. New content: buku baru terdeteksi, setelah markSeen hilang
 * 10. Similar books: filter by shared category
 */

import {
  getLockedBooks,
  sortForDisplay,
  getSimilarBooks,
  getNewContentIds,
  markContentSeen,
  appendReadingLog,
  getUnlockProgress,
} from "../lib/recommendation";
import { getDatabase } from "../lib/database";

jest.mock("../lib/database");

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// Helper: build a mock DB that returns reading_log rows
function createMockDb(logRows: { book_id: string; completed_at: string }[] = [], seenRows: { content_id: string }[] = []) {
  return {
    getAllAsync: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("reading_log")) return Promise.resolve(logRows);
      if (sql.includes("seen_content")) return Promise.resolve(seenRows);
      return Promise.resolve([]);
    }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    execAsync: jest.fn(),
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Lock Tests ---

describe("Lock: 3x consecutive same book", () => {
  it("locks book after 3 consecutive completions", async () => {
    const db = createMockDb([
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 10);
    expect(locked.has("1")).toBe(true);
  });

  it("locks article after 3 consecutive completions", async () => {
    const db = createMockDb([
      { book_id: "article-112", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "article-112", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "article-112", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 10);
    expect(locked.has("article-112")).toBe(true);
  });

  it("does NOT lock if less than 3 consecutive", async () => {
    const db = createMockDb([
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 10);
    expect(locked.size).toBe(0);
  });

  it("does NOT lock if total content < 5", async () => {
    const db = createMockDb([
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 4);
    expect(locked.size).toBe(0);
  });
});

describe("Unlock: 3 different reads after lock", () => {
  it("unlocks after reading 3 different content", async () => {
    const db = createMockDb([
      // Most recent first
      { book_id: "4", completed_at: "2026-03-14T06:00:00Z" },
      { book_id: "3", completed_at: "2026-03-14T05:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T04:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 10);
    expect(locked.has("1")).toBe(false);
  });

  it("stays locked if only 2 different reads after streak", async () => {
    const db = createMockDb([
      { book_id: "3", completed_at: "2026-03-14T05:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T04:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 10);
    expect(locked.has("1")).toBe(true);
  });
});

describe("Multiple locks", () => {
  it("allows multiple books locked if unlocked >= 3", async () => {
    const db = createMockDb([
      // B locked (most recent streak)
      { book_id: "2", completed_at: "2026-03-14T06:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T05:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T04:00:00Z" },
      // A locked (earlier streak)
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    // Total 5 books → 5 - 2 locked = 3 unlocked, OK
    const locked = await getLockedBooks(1, 5);
    expect(locked.has("1")).toBe(true);
    expect(locked.has("2")).toBe(true);
    expect(locked.size).toBe(2);
  });

  it("guard: stops locking if unlocked would be < 3", async () => {
    const db = createMockDb([
      // C streak
      { book_id: "3", completed_at: "2026-03-14T09:00:00Z" },
      { book_id: "3", completed_at: "2026-03-14T08:00:00Z" },
      { book_id: "3", completed_at: "2026-03-14T07:00:00Z" },
      // B streak
      { book_id: "2", completed_at: "2026-03-14T06:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T05:00:00Z" },
      { book_id: "2", completed_at: "2026-03-14T04:00:00Z" },
      // A streak
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    // Total 5 books → can only lock 2 (5-2=3 unlocked). 3rd lock would make unlocked=2
    const locked = await getLockedBooks(1, 5);
    expect(locked.size).toBe(2);
    // Most recent streaks get locked first
    expect(locked.has("3")).toBe(true);
    expect(locked.has("2")).toBe(true);
    expect(locked.has("1")).toBe(false); // guard prevents
  });
});

describe("Parent unlock", () => {
  it("unlock override breaks lock", async () => {
    const db = createMockDb([
      // Unlock override after streak
      { book_id: "__unlock:1", completed_at: "2026-03-14T04:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const locked = await getLockedBooks(1, 10);
    expect(locked.has("1")).toBe(false);
  });
});

// --- Unlock Progress ---

describe("Unlock progress", () => {
  it("returns remaining count to unlock", async () => {
    const db = createMockDb([
      { book_id: "2", completed_at: "2026-03-14T04:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T03:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T02:00:00Z" },
      { book_id: "1", completed_at: "2026-03-14T01:00:00Z" },
    ]);
    mockGetDatabase.mockResolvedValue(db);

    const progress = await getUnlockProgress(1, "1");
    expect(progress).toBe(2); // need 2 more different reads
  });
});

// --- Sorting ---

describe("Sort books for display", () => {
  const books = [
    { id: "1", title: "A", coverPath: null, pageCount: 10, hasAudio: false },
    { id: "2", title: "B", coverPath: null, pageCount: 10, hasAudio: false },
    { id: "3", title: "C", coverPath: null, pageCount: 10, hasAudio: false },
    { id: "4", title: "D", coverPath: null, pageCount: 10, hasAudio: false },
  ];

  it("sorts: in-progress > unread > completed > locked", () => {
    const progress: Record<string, { lastPage: number; completed: boolean; completedCount: number }> = {
      "1": { lastPage: 5, completed: false, completedCount: 0 }, // in-progress
      "3": { lastPage: 9, completed: true, completedCount: 3 },  // completed 3x
      "4": { lastPage: 9, completed: true, completedCount: 1 },  // completed 1x
      // "2" = unread
    };
    const lockedSet = new Set(["3"]);

    const sorted = sortForDisplay(books, progress, lockedSet);

    expect(sorted[0].id).toBe("1"); // in-progress first
    expect(sorted[1].id).toBe("2"); // unread
    expect(sorted[2].id).toBe("4"); // completed 1x
    expect(sorted[3].id).toBe("3"); // locked last
  });

  it("within completed, sorts by completedCount ascending", () => {
    const progress: Record<string, { lastPage: number; completed: boolean; completedCount: number }> = {
      "1": { lastPage: 9, completed: true, completedCount: 5 },
      "2": { lastPage: 9, completed: true, completedCount: 1 },
      "3": { lastPage: 9, completed: true, completedCount: 3 },
    };

    const sorted = sortForDisplay(books, progress, new Set());

    // unread first, then ascending completedCount
    expect(sorted[0].id).toBe("4"); // unread
    expect(sorted[1].id).toBe("2"); // 1x
    expect(sorted[2].id).toBe("3"); // 3x
    expect(sorted[3].id).toBe("1"); // 5x
  });
});

// --- New Content ---

describe("New content detection", () => {
  it("detects unseen content", async () => {
    const db = createMockDb([], [{ content_id: "1" }, { content_id: "2" }]);
    mockGetDatabase.mockResolvedValue(db);

    const newIds = await getNewContentIds(1, ["1", "2", "3", "4"]);
    expect(newIds).toEqual(["3", "4"]);
  });

  it("markContentSeen inserts into seen_content", async () => {
    const db = createMockDb();
    mockGetDatabase.mockResolvedValue(db);

    await markContentSeen(1, "3");
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO seen_content"),
      1, "3"
    );
  });
});

// --- Similar Books ---

describe("Similar books by category", () => {
  const books = [
    { id: "1", title: "A", coverPath: null, pageCount: 10, hasAudio: false, categories: ["islam", "sahabat"] },
    { id: "2", title: "B", coverPath: null, pageCount: 10, hasAudio: false, categories: ["islam", "nabi"] },
    { id: "3", title: "C", coverPath: null, pageCount: 10, hasAudio: false, categories: ["science"] },
    { id: "4", title: "D", coverPath: null, pageCount: 10, hasAudio: false, categories: ["sahabat"] },
  ];

  it("returns books sharing at least 1 category", () => {
    const similar = getSimilarBooks("1", books as any);
    const ids = similar.map(b => b.id);
    expect(ids).toContain("2"); // shares "islam"
    expect(ids).toContain("4"); // shares "sahabat"
    expect(ids).not.toContain("3"); // no shared category
    expect(ids).not.toContain("1"); // excludes self
  });

  it("returns empty if no categories", () => {
    const noCatBooks = [
      { id: "1", title: "A", coverPath: null, pageCount: 10, hasAudio: false },
      { id: "2", title: "B", coverPath: null, pageCount: 10, hasAudio: false },
    ];
    const similar = getSimilarBooks("1", noCatBooks as any);
    expect(similar).toEqual([]);
  });
});

// --- Append Reading Log ---

describe("appendReadingLog", () => {
  it("inserts into reading_log table", async () => {
    const db = createMockDb();
    mockGetDatabase.mockResolvedValue(db);

    await appendReadingLog(1, "book-1");
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO reading_log"),
      1, "book-1"
    );
  });
});
