/**
 * Bug #7 — sync harus ter-trigger saat child aktif berubah.
 *
 * Skenario: selectChild dipanggil setelah mount-sync. Sebelum fix,
 * tidak ada mekanisme yang memicu push ulang untuk child yang baru
 * dipilih — data queued menunggu sampai AppState foreground transition.
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

describe("Bug #7: sync ter-trigger saat child dipilih", () => {
  it("selectChild → syncAll untuk child tersebut (push data pending)", async () => {
    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const database = require("../lib/database") as typeof import("../lib/database");
    const session = require("../lib/session") as typeof import("../lib/session");
    const api = require("../lib/api") as jest.Mocked<typeof import("../lib/api")>;

    api.isLoggedIn.mockResolvedValue(true);
    api.fetchChildren.mockResolvedValue([
      { id: 1, name: "A", age: 8, avatar_color: "#111", coins: 0, stars: 0 },
    ]);

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    await db.runAsync(
      "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (?, 'coin', 5, ?, 0)",
      1, "Pending reward"
    );

    // Wire the trigger under test.
    const detach = sync.attachSessionSyncTrigger();

    // No push has happened yet.
    expect(api.pushRewardsBulk).not.toHaveBeenCalled();

    session.selectChild({ id: 1, name: "A", age: 8 });

    await waitForCall(api.pushRewardsBulk);
    expect(api.pushRewardsBulk).toHaveBeenCalled();
    expect(api.pushRewardsBulk.mock.calls[0][0]).toBe(1);

    detach();
  });
});
