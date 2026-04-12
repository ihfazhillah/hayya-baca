/**
 * D2 — Piggyback device telemetry on push payload.
 *
 * Motivation: the original "2 minggu no data" bug was invisible because we
 * had no signal from devices. Each push carries a small telemetry blob so
 * the backend can answer "which device is silent, and why?" without needing
 * a new endpoint.
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

jest.mock("expo-constants", () => ({ expoConfig: { version: "9.9.9-test" } }));
jest.mock("expo-device", () => ({ modelName: "Test Device" }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "test-device-telemetry" }));

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
  const apiMod = require("../lib/api") as jest.Mocked<typeof import("../lib/api")>;
  return { syncAll: sync.syncAll, getDatabase: database.getDatabase, api: apiMod };
}

describe("D2: push payload piggybacks device telemetry", () => {
  it("pushRewardsBulk receives a telemetry blob with all expected fields", async () => {
    const mods = getModules();

    const db = await mods.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (1, 'A', '#111', 0, 0, 8, 1)"
    );
    // 3 unsynced rewards and 2 unsynced progress rows → non-trivial queue depths.
    for (let i = 0; i < 3; i++) {
      await db.runAsync(
        "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 1, ?, 0)",
        `r${i}`
      );
    }
    for (let i = 0; i < 2; i++) {
      await db.runAsync(
        "INSERT OR REPLACE INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced) VALUES (1, ?, 5, 0, 0, ?, 0)",
        `book-${i}`, new Date().toISOString()
      );
    }

    // Seed a prior failure so telemetry surfaces last_sync_error.
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_error', 'simulated network timeout')"
    );

    await mods.syncAll([1]);

    expect(mods.api.pushRewardsBulk).toHaveBeenCalledTimes(1);
    const telemetry = (mods.api.pushRewardsBulk.mock.calls[0] as any[])[2];
    expect(telemetry).toBeDefined();
    expect(typeof telemetry.device_id).toBe("string");
    expect(telemetry.device_id.length).toBeGreaterThan(0);
    expect(telemetry.app_version).toBe("9.9.9-test");
    // Queue depth is measured BEFORE the push marks rows synced.
    expect(telemetry.queue_depth_rewards).toBe(3);
    expect(telemetry.queue_depth_progress).toBe(2);
    expect(telemetry.last_sync_error).toBe("simulated network timeout");
    // last_successful_sync_at may be null on a fresh install — the field must
    // still be present so the server can distinguish "never synced" from
    // "missing key".
    expect(telemetry).toHaveProperty("last_successful_sync_at");
  });

  it("successful sync updates last_successful_sync_at and clears last_sync_error", async () => {
    const mods = getModules();

    const db = await mods.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (1, 'A', '#111', 0, 0, 8, 1)"
    );
    await db.runAsync(
      "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 1, 'r', 0)"
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_error', 'stale error')"
    );

    const before = Date.now();
    const report = await mods.syncAll([1]);
    expect(report.success).toBe(true);

    const ok = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_successful_sync_at'"
    );
    expect(ok?.value).toBeDefined();
    const ts = Date.parse(ok!.value);
    expect(ts).toBeGreaterThanOrEqual(before);

    const err = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_sync_error'"
    );
    expect(err?.value ?? "").toBe("");
  });
});
