/**
 * BC-3 — One bad book slug must not poison the whole reading_progress push.
 *
 * Server may reject a single book (e.g., 400 on validation). The per-book
 * loop in sync.ts already marks only the successes, but it's the kind of
 * invariant that quietly regresses when someone "simplifies" the loop into
 * a bulk call. Regression guard.
 *
 * Spec: specs/01-sync-problem/edge-cases.md §BC-3.
 */
import Database from "better-sqlite3";

let mockTestDb: ReturnType<typeof Database>;

function mockCreateTestDb() {
  mockTestDb = new Database(":memory:");
  mockTestDb.pragma("journal_mode = WAL");
  return {
    execAsync: async (sql: string) => { mockTestDb.exec(sql); },
    runAsync: async (sql: string, ...params: any[]) => {
      const stmt = mockTestDb.prepare(sql);
      const result = stmt.run(...params);
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
    },
    getFirstAsync: async <T>(sql: string, ...params: any[]): Promise<T | null> => {
      const stmt = mockTestDb.prepare(sql);
      return (stmt.get(...params) as T) ?? null;
    },
    getAllAsync: async <T>(sql: string, ...params: any[]): Promise<T[]> => {
      const stmt = mockTestDb.prepare(sql);
      return stmt.all(...params) as T[];
    },
  };
}

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn().mockImplementation(async () => mockCreateTestDb()),
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "0.1.0-test" } }));
jest.mock("expo-device", () => ({ modelName: "Test Device" }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "device-bc3" }));

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    isLoggedIn: jest.fn().mockResolvedValue(true),
    fetchChildren: jest.fn().mockResolvedValue([
      { id: 1, name: "Aisyah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]),
    createChildOnServer: jest.fn(),
    pushReadingProgress: jest.fn().mockImplementation(async (_childId: number, payload: any) => {
      if (payload.book === "bad-slug") {
        return `pushReadingProgress 400: {"book": ["Object with slug=bad-slug does not exist."]}`;
      }
      return null;
    }),
    pushRewardsBulk: jest.fn().mockResolvedValue(null),
    pushReadingLog: jest.fn().mockResolvedValue(null),
    fetchReadingLog: jest.fn().mockResolvedValue([]),
    fetchRewardHistory: jest.fn().mockResolvedValue([]),
    fetchReadingProgressFromServer: jest.fn().mockResolvedValue([]),
    pushBookmarks: jest.fn().mockResolvedValue(null),
    pullBookmarks: jest.fn().mockResolvedValue([]),
  };
});

beforeEach(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
  jest.resetModules();
  jest.clearAllMocks();
});

afterAll(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
});

describe("BC-3: one failing book must not block siblings in reading_progress push", () => {
  it("only the 400 book stays unsynced; good books converge", async () => {
    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (1, 'Aisyah', '#E91E63', 0, 0, 8, 1)"
    );
    // Three books: two known slugs + one the server will reject.
    for (const book of ["1", "bad-slug", "3"]) {
      await db.runAsync(
        `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced)
         VALUES (?, ?, ?, 0, 0, datetime('now'), 0)`,
        1, book, 5
      );
    }

    const report = await sync.syncAll([1]);

    // Overall run is marked unsuccessful because errors were recorded,
    // but the two good books still landed.
    expect(report.errors.some((e) => /bad-slug/.test(e))).toBe(true);
    expect(report.progressPushed).toBe(2);

    const rows = await db.getAllAsync<{ book_id: string; synced: number }>(
      "SELECT book_id, synced FROM reading_progress WHERE child_id = 1 ORDER BY book_id"
    );
    const byBook = Object.fromEntries(rows.map((r) => [r.book_id, r.synced]));
    expect(byBook["1"]).toBe(1);
    expect(byBook["3"]).toBe(1);
    expect(byBook["bad-slug"]).toBe(0);
  });
});
