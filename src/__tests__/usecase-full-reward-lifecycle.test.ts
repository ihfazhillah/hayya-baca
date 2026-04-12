/**
 * D1 — Integration test lintas bug.
 *
 * Alur (perspektif device A, device B di-simulasikan dengan memutasi
 * server state langsung):
 *  1. Device A earn 10 koin, baca hal 5, sync (Bug #1, #2).
 *  2. Device B kontribusi ke server: baca hal 12, spend 3 koin.
 *  3. Device A sync lagi → lihat hal 12 (Bug #4 MAX) & coins 7 (Bug #9).
 *  4. Sync berulang tidak duplikat (idempotency).
 *  5. recalculateBalance deterministik (Bug #8 atomik).
 */

import Database from "better-sqlite3";

let mockTestDb: ReturnType<typeof Database>;

// Simulated server state — persistent across syncs within a test.
const serverState: {
  rewards: Record<number, { type: string; count: number; description: string; created_at: string; idempotency_key: string }[]>;
  progress: Record<number, Record<string, { book: string; last_page: number; completed: boolean; completed_count: number; updated_at: string }>>;
} = { rewards: {}, progress: {} };

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
jest.mock("expo-device", () => ({ modelName: "Test Device A" }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "device-A" }));

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    isLoggedIn: jest.fn().mockResolvedValue(true),
    fetchChildren: jest.fn().mockResolvedValue([
      { id: 1, name: "Sakinah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]),
    createChildOnServer: jest.fn(),
    pushReadingProgress: jest.fn().mockImplementation(async (childId: number, data: any) => {
      if (!serverState.progress[childId]) serverState.progress[childId] = {};
      const existing = serverState.progress[childId][data.book];
      serverState.progress[childId][data.book] = {
        book: data.book,
        last_page: Math.max(existing?.last_page ?? 0, data.last_page),
        completed: existing?.completed || data.completed,
        completed_count: Math.max(existing?.completed_count ?? 0, data.completed_count),
        updated_at: new Date().toISOString(),
      };
      return null;
    }),
    pushRewardsBulk: jest.fn().mockImplementation(async (childId: number, rewards: any[]) => {
      if (!serverState.rewards[childId]) serverState.rewards[childId] = [];
      for (const r of rewards) {
        if (serverState.rewards[childId].some((x) => x.idempotency_key === r.idempotency_key)) continue;
        serverState.rewards[childId].push({
          type: r.type,
          count: r.count,
          description: r.description,
          created_at: r.created_at,
          idempotency_key: r.idempotency_key,
        });
      }
      return null;
    }),
    pushReadingLog: jest.fn().mockResolvedValue(null),
    fetchReadingLog: jest.fn().mockResolvedValue([]),
    fetchRewardHistory: jest.fn().mockImplementation(async (childId: number) => serverState.rewards[childId] ?? []),
    fetchReadingProgressFromServer: jest.fn().mockImplementation(async (childId: number) =>
      Object.values(serverState.progress[childId] ?? {})
    ),
    pushBookmarks: jest.fn().mockResolvedValue(null),
    pullBookmarks: jest.fn().mockResolvedValue([]),
  };
});

beforeEach(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
  jest.resetModules();
  jest.clearAllMocks();
  serverState.rewards = {};
  serverState.progress = {};
});

afterAll(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
});

describe("D1: full reward lifecycle across two devices", () => {
  it("A earn+read → sync → B mutates server → A resync → consistent, no duplicates", async () => {
    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "Sakinah", "#E91E63", 1
    );

    // --- Phase 1: device A earns 10 coins + reads to page 5 ---
    await rewards.addReward(1, "coin", 10, "Baca buku");
    await rewards.saveReadingProgress(1, "1", 5, false);
    await sync.syncAll([1]);

    expect(serverState.rewards[1].length).toBe(1);
    expect(serverState.rewards[1][0].count).toBe(10);
    expect(serverState.progress[1]["1"].last_page).toBe(5);

    // --- Phase 2: simulate device B contributing to server state ---
    // B read book "1" up to page 12 and spent 3 coins on a game.
    serverState.rewards[1].push({
      type: "coin_spend",
      count: -3,
      description: "Beli game (device B)",
      created_at: "2026-04-05T10:00:00",
      idempotency_key: "device-B:1",
    });
    serverState.progress[1]["1"] = {
      book: "1",
      last_page: 12,
      completed: false,
      completed_count: 0,
      updated_at: "2026-04-05T10:00:00",
    };

    // --- Phase 3: device A re-syncs, must converge ---
    await sync.syncAll([1]);

    let row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(7); // Bug #9: coin_spend counted in recalc

    const prog = await db.getFirstAsync<{ last_page: number }>(
      "SELECT last_page FROM reading_progress WHERE child_id = 1 AND book_id = '1'"
    );
    expect(prog?.last_page).toBe(12); // Bug #4: per-field MAX picks server value

    // --- Phase 4: repeated syncs must not duplicate ---
    const countBefore = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM reward_history WHERE child_id = 1"
    );
    await sync.syncAll([1]);
    await sync.syncAll([1]);
    const countAfter = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM reward_history WHERE child_id = 1"
    );
    expect(countAfter?.cnt).toBe(countBefore?.cnt);

    // --- Phase 5: recalcBalance still deterministic (Bug #8) ---
    await rewards.recalculateBalance(1);
    row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(7);

    // --- Phase 6: Bug #1 — syncAll() without childIds still pushes ---
    // Add another reward, trigger a mount-style syncAll() with no args.
    await rewards.addReward(1, "coin", 2, "Baca lagi");
    await sync.syncAll(); // no args
    const allKeys = serverState.rewards[1].map((r) => r.idempotency_key);
    // The newly added local reward must reach the server.
    expect(allKeys.some((k) => k.startsWith("device-A:"))).toBe(true);
    expect(serverState.rewards[1].filter((r) => r.type === "coin" && r.count === 2).length).toBe(1);
  });
});
