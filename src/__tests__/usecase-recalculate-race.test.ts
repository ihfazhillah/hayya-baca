/**
 * Bug #8 — recalculateBalance race vs addReward.
 *
 * Spec §Bug #8: recalculate membaca SUM lalu UPDATE dua langkah. Kalau
 * addReward interleave di gap, UPDATE recalculate bisa menimpa hasilnya.
 *
 * Test mencoba reproduce dengan 50 iterasi Promise.all([addReward, recalc]).
 * Kalau better-sqlite3 sequential menutupi race, test akan PASS dan kita
 * tambah angle manual (direct SELECT-then-UPDATE gap).
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
    isLoggedIn: jest.fn().mockResolvedValue(false), // off — avoid opportunistic sync interference
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

describe("Bug #8: recalculateBalance race vs addReward", () => {
  it("50 iterasi Promise.all([addReward, recalc]) → coins final konsisten", async () => {
    const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );

    const N = 50;
    for (let i = 0; i < N; i++) {
      await Promise.all([
        rewards.addReward(1, "coin", 1, `r${i}`),
        rewards.recalculateBalance(1),
      ]);
    }

    // Final: N rewards, coins must == N (no lost updates).
    const row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    const count = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM reward_history WHERE child_id = 1");
    expect(count?.cnt).toBe(N);
    expect(row?.coins).toBe(N);
  });
});
