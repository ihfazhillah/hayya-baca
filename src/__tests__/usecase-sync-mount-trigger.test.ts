/**
 * Bug #1 — mount-sync (syncAll tanpa childIds) tidak push data anak.
 *
 * Skenario spec §Bug #1:
 *   Given: logged in, 4 anak, tiap anak 1 reward synced=0
 *   When:  syncAll() tanpa childIds
 *   Then:  pushRewardsBulk dipanggil untuk keempat anak
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
    fetchChildren: jest.fn().mockResolvedValue([]),
    createChildOnServer: jest.fn(),
    pushReadingProgress: jest.fn().mockResolvedValue(null),
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

function getModules() {
  const sync = require("../lib/sync") as typeof import("../lib/sync");
  const database = require("../lib/database") as typeof import("../lib/database");
  const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
  const apiMod = require("../lib/api") as jest.Mocked<typeof import("../lib/api")>;
  return { syncAll: sync.syncAll, getDatabase: database.getDatabase, addReward: rewards.addReward, api: apiMod };
}

describe("Bug #1: mount-sync (syncAll tanpa childIds) push semua anak lokal", () => {
  it("syncAll() memanggil pushRewardsBulk untuk keempat anak", async () => {
    const mods = getModules();

    mods.api.isLoggedIn.mockResolvedValue(true);
    mods.api.fetchChildren.mockResolvedValue([
      { id: 1, name: "A", age: 8, avatar_color: "#111", coins: 0, stars: 0 },
      { id: 2, name: "B", age: 7, avatar_color: "#222", coins: 0, stars: 0 },
      { id: 3, name: "C", age: 6, avatar_color: "#333", coins: 0, stars: 0 },
      { id: 4, name: "D", age: 5, avatar_color: "#444", coins: 0, stars: 0 },
    ]);
    mods.api.pushRewardsBulk.mockResolvedValue(null);

    const db = await mods.getDatabase();
    for (const id of [1, 2, 3, 4]) {
      await db.runAsync(
        "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
        id, `Child${id}`, "#E91E63", id
      );
      // Insert rewards directly to avoid addReward's opportunistic push
      // interfering with the mount-sync assertion under test.
      await db.runAsync(
        "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (?, 'coin', 3, ?, 0)",
        id, `Reward anak ${id}`
      );
    }

    const report = await mods.syncAll();

    expect(report.notLoggedIn).toBeFalsy();
    expect(mods.api.pushRewardsBulk).toHaveBeenCalledTimes(4);
    const pushedChildIds = mods.api.pushRewardsBulk.mock.calls.map((c) => c[0]).sort();
    expect(pushedChildIds).toEqual([1, 2, 3, 4]);
  });
});
