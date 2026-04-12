/**
 * MC-2 — Session switch must flush ALL children's unsynced rows, not just
 * the newly-selected one.
 *
 * Skenario: Aisyah baca offline, accumulate reward, belum push. Pagi, Umar
 * tap profile-nya sendiri. `attachSessionSyncTrigger` fires on the change.
 * Pre-fix: trigger pass `[umar.id]`, so syncRewards hanya iterasi child Umar
 * — Aisyah's queue stays on-device sampai mount restart atau NetInfo
 * reconnect. Post-fix: trigger pass no args → syncAll walks semua children.
 *
 * Spec: specs/01-sync-problem/edge-cases.md §MC-2.
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
jest.mock("expo-crypto", () => ({ randomUUID: () => "device-mc2" }));

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    isLoggedIn: jest.fn().mockResolvedValue(true),
    fetchChildren: jest.fn().mockResolvedValue([
      { id: 1, name: "Aisyah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
      { id: 2, name: "Umar", age: 6, avatar_color: "#2196F3", coins: 0, stars: 0 },
    ]),
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

async function flush() {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 10));
}

describe("MC-2: session switch flushes every child's unsynced queue", () => {
  it("selecting Umar pushes Aisyah's pending rewards too", async () => {
    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const database = require("../lib/database") as typeof import("../lib/database");
    const session = require("../lib/session") as typeof import("../lib/session");
    const apiMod = require("../lib/api") as jest.Mocked<typeof import("../lib/api")>;

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (1, 'Aisyah', '#E91E63', 0, 0, 8, 1)"
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (2, 'Umar', '#2196F3', 0, 0, 6, 2)"
    );
    // Aisyah has queued rewards, never pushed.
    await db.runAsync(
      "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 5, 'Baca 1', 0)"
    );
    await db.runAsync(
      "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 3, 'Baca 2', 0)"
    );

    // Start with Aisyah selected so the subscribe baseline is set.
    session.selectChild({ id: 1, name: "Aisyah", age: 8 });
    const detach = sync.attachSessionSyncTrigger();

    // Simulate "mama hands tablet to Umar" — profile switch.
    session.selectChild({ id: 2, name: "Umar", age: 6 });
    await flush();

    const pushedChildIds = apiMod.pushRewardsBulk.mock.calls.map((c) => c[0]);
    expect(pushedChildIds).toContain(1);

    // Aisyah's two rows must now be marked synced locally.
    const leftover = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM reward_history WHERE child_id = 1 AND synced = 0"
    );
    expect(leftover.length).toBe(0);

    detach();
  });
});
