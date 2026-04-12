/**
 * Bug #5 — Hypothesis test.
 *
 * Spec §Bug #5 menduga `recalculateBalance` bisa menurunkan coins saat
 * `fetchRewardHistory` return subset (partial). Kalau hipotesis benar,
 * coins turun. Kalau salah, test PASS dan bug dieliminasi dari log.
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
    isLoggedIn: jest.fn().mockResolvedValue(true),
    fetchChildren: jest.fn().mockResolvedValue([
      { id: 1, name: "A", age: 8, avatar_color: "#111", coins: 0, stars: 0 },
    ]),
    pushRewardsBulk: jest.fn().mockResolvedValue(null),
    pushReadingProgress: jest.fn().mockResolvedValue(null),
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

describe("Bug #5: recalculate tidak boleh turun setelah pull subset dari server", () => {
  it("10 local rewards (SUM 50). Server mock return 2 subset → coins tetap 50", async () => {
    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const api = require("../lib/api") as jest.Mocked<typeof import("../lib/api")>;
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    // 10 local rewards already synced (simulate past state), sum 50.
    for (let i = 0; i < 10; i++) {
      await db.runAsync(
        "INSERT INTO reward_history (child_id, type, count, description, synced, idempotency_key) VALUES (?, 'coin', 5, ?, 1, ?)",
        1, `r${i}`, `test-device-id-A:${i + 1}`
      );
    }
    await db.runAsync("UPDATE children SET coins = 50 WHERE id = 1");

    // Server only returns 2 of the 10 (subset — pagination/filter/partial)
    api.fetchRewardHistory.mockResolvedValue([
      { type: "coin", count: 5, description: "r0", created_at: "2026-04-01T00:00:00", idempotency_key: "test-device-id-A:1" },
      { type: "coin", count: 5, description: "r1", created_at: "2026-04-01T00:00:00", idempotency_key: "test-device-id-A:2" },
    ] as any);

    await sync.syncAll([1]);

    const row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(50);
  });
});
