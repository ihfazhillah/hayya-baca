/**
 * Bug #2 — addReward/saveReadingProgress harus trigger opportunistic push.
 *
 * Spec §Bug #2:
 *   addReward(1, 'coin', 3, ...)
 *   await delay(500)
 *   → pushRewardsBulk dipanggil untuk reward tersebut (non-blocking)
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
  return { sync, getDatabase: database.getDatabase, rewards, api: apiMod };
}

async function seedChild(db: any, id: number) {
  await db.runAsync(
    "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
    id, `Child${id}`, "#E91E63", id
  );
}

function waitForCall(mockFn: jest.Mock, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (mockFn.mock.calls.length > 0) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting for mock call"));
      setTimeout(tick, 20);
    };
    tick();
  });
}

describe("Bug #2: opportunistic push after addReward / saveReadingProgress", () => {
  it("addReward → pushRewardsBulk dipanggil tanpa syncAll manual", async () => {
    const mods = getModules();
    mods.api.isLoggedIn.mockResolvedValue(true);
    mods.api.fetchChildren.mockResolvedValue([
      { id: 1, name: "A", age: 8, avatar_color: "#111", coins: 0, stars: 0 },
    ]);

    const db = await mods.getDatabase();
    await seedChild(db, 1);

    await mods.rewards.addReward(1, "coin", 3, "Baca buku");

    await waitForCall(mods.api.pushRewardsBulk);
    expect(mods.api.pushRewardsBulk).toHaveBeenCalled();
    expect(mods.api.pushRewardsBulk.mock.calls[0][0]).toBe(1);
  });

  it("saveReadingProgress → pushReadingProgress dipanggil tanpa syncAll manual", async () => {
    const mods = getModules();
    mods.api.isLoggedIn.mockResolvedValue(true);
    mods.api.fetchChildren.mockResolvedValue([
      { id: 1, name: "A", age: 8, avatar_color: "#111", coins: 0, stars: 0 },
    ]);

    const db = await mods.getDatabase();
    await seedChild(db, 1);

    await mods.rewards.saveReadingProgress(1, "book-1", 5, false);

    await waitForCall(mods.api.pushReadingProgress);
    expect(mods.api.pushReadingProgress).toHaveBeenCalled();
  });
});
