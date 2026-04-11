/**
 * Bug #4 — mergeServerReadingProgress harus pakai MAX per-field, bukan LWW.
 *
 * Skenario spec §Bug #4: local last_page=12 lebih baru secara fakta tapi
 * server punya updated_at lebih baru dengan last_page=3. LWW-by-timestamp
 * akan menurunkan last_page ke 3 — data hilang.
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
jest.mock("expo-crypto", () => ({ randomUUID: () => "test-device-id-A" }));

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    isLoggedIn: jest.fn().mockResolvedValue(false),
    fetchChildren: jest.fn().mockResolvedValue([]),
    pushRewardsBulk: jest.fn().mockResolvedValue(null),
    pushReadingProgress: jest.fn().mockResolvedValue(null),
    pushReadingLog: jest.fn().mockResolvedValue(null),
    fetchReadingLog: jest.fn().mockResolvedValue([]),
    fetchRewardHistory: jest.fn().mockResolvedValue([]),
    fetchReadingProgressFromServer: jest.fn().mockResolvedValue([]),
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

describe("Bug #4: mergeServerReadingProgress pakai MAX per-field", () => {
  it("local last_page=12 vs server last_page=3 (updated_at lebih baru) → MAX=12", async () => {
    const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    await db.runAsync(
      `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced)
       VALUES (1, '1', 12, 0, 3, '2026-04-01T10:00:00', 1)`
    );

    await rewards.mergeServerReadingProgress(1, [
      { book: "1", last_page: 3, completed: false, completed_count: 1, updated_at: "2026-04-10T10:00:00" },
    ]);

    const row = await db.getFirstAsync<{ last_page: number; completed_count: number }>(
      "SELECT last_page, completed_count FROM reading_progress WHERE child_id = 1 AND book_id = '1'"
    );
    expect(row?.last_page).toBe(12);
    expect(row?.completed_count).toBe(3);
  });

  it("server last_page=20 vs local last_page=5 → MAX=20, completed status diambil OR", async () => {
    const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    await db.runAsync(
      `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced)
       VALUES (1, '1', 5, 0, 0, '2026-04-01T10:00:00', 1)`
    );

    await rewards.mergeServerReadingProgress(1, [
      { book: "1", last_page: 20, completed: true, completed_count: 2, updated_at: "2026-04-02T10:00:00" },
    ]);

    const row = await db.getFirstAsync<{ last_page: number; completed: number; completed_count: number }>(
      "SELECT last_page, completed, completed_count FROM reading_progress WHERE child_id = 1 AND book_id = '1'"
    );
    expect(row?.last_page).toBe(20);
    expect(row?.completed).toBe(1);
    expect(row?.completed_count).toBe(2);
  });
});
