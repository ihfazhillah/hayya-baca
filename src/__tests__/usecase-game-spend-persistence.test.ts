/**
 * Bug #9 — game purchase harus tercatat di reward_history.
 *
 * Scenario spec §Bug #9:
 *   children.coins=50. Buy game cost 5 → 45. Lalu recalculateBalance.
 *   Jika pengurangan koin hanya di `children.coins` (updateChildCoins),
 *   recalc akan mengembalikan coins ke SUM(reward_history)=50.
 *   Fix: game spend ditulis sebagai row reward_history bertipe coin_spend
 *   (count negatif), sehingga recalc mempertahankan saldo 45.
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

describe("Bug #9: game spend tercatat di reward_history", () => {
  it("updateChildCoins(-5) + recalculateBalance → coins balik jadi 50 (bug)", async () => {
    const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
    const children = require("../lib/children") as typeof import("../lib/children");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    for (let i = 0; i < 10; i++) {
      await rewards.addReward(1, "coin", 5, `Baca ${i}`);
    }

    // Old buggy path: decrement via updateChildCoins — nothing written to history
    await children.updateChildCoins(1, -5);
    let row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(45);

    // Any subsequent recalc (screen focus, sync, etc.) rolls back to 50.
    await rewards.recalculateBalance(1);
    row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(50); // this is the bug
  });

  it("addReward coin_spend → recalculateBalance → coins tetap 45 (fix)", async () => {
    const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    for (let i = 0; i < 10; i++) {
      await rewards.addReward(1, "coin", 5, `Baca ${i}`);
    }

    await rewards.addReward(1, "coin_spend", -5, "Beli game: tebak angka");
    let row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(45);

    await rewards.recalculateBalance(1);
    row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(45);

    // Spend row is persisted and unsynced → will reach server next push
    const spendRow = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM reward_history WHERE child_id = 1 AND type = 'coin_spend' AND synced = 0"
    );
    expect(spendRow?.cnt).toBe(1);
  });

  it("production code: game screen uses addReward('coin_spend', ...) not updateChildCoins", () => {
    const fs = require("fs");
    const path = require("path");
    const file = fs.readFileSync(path.join(__dirname, "../../app/game/[gameId].tsx"), "utf8");
    // Guard-rail: game screen must not call updateChildCoins anymore.
    expect(file).not.toMatch(/updateChildCoins\s*\(/);
    // And must record the spend via addReward with coin_spend type.
    expect(file).toMatch(/addReward\([^)]*coin_spend/);
  });
});
