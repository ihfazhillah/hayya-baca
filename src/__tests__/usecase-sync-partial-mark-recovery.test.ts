/**
 * MC-3 — Force-kill mid-sync dengan queue multi-child.
 *
 * Skenario: app di-kill tepat saat `markRewardsSynced` sudah update sebagian
 * baris di loop per-row UPDATE (`rewards.ts:57-68`). Hasilnya: server sudah
 * menerima SEMUA reward (idempotency_key sudah di-insert), tapi secara lokal
 * sebagian baris masih `synced=0`.
 *
 * Ekspektasi invariant: run `syncAll` berikutnya harus pick up sisa row,
 * push lagi, server dedupe via idempotency_key (return 0 created, N skipped),
 * lalu mark sisa row sebagai synced. Tidak ada duplikat di server, tidak ada
 * baris yang tertinggal `synced=0` selamanya.
 *
 * Spec: specs/01-sync-problem/edge-cases.md §MC-3. Spec menandai case ini
 * "already mitigated by idempotency" — test ini adalah regression guard
 * bukan reproduksi bug aktif.
 */

import Database from "better-sqlite3";

let mockTestDb: ReturnType<typeof Database>;

const serverState: {
  rewards: Record<number, { type: string; count: number; description: string; created_at: string; idempotency_key: string }[]>;
} = { rewards: {} };

const mockCounters = { pushCallCount: 0 };

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
    pushReadingProgress: jest.fn().mockResolvedValue(null),
    pushRewardsBulk: jest.fn().mockImplementation(async (childId: number, rewards: any[]) => {
      mockCounters.pushCallCount++;
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
    fetchReadingProgressFromServer: jest.fn().mockResolvedValue([]),
  };
});

beforeEach(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
  jest.resetModules();
  jest.clearAllMocks();
  serverState.rewards = {};
  mockCounters.pushCallCount = 0;
});

afterAll(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
});

describe("MC-3: partial markRewardsSynced is recoverable on next syncAll", () => {
  it("mid-loop crash → next sync re-pushes, server dedupes, lokal converge synced=1", async () => {
    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const rewardsLib = require("../lib/rewards") as typeof import("../lib/rewards");
    const database = require("../lib/database") as typeof import("../lib/database");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "Sakinah", "#E91E63", 1
    );

    // Insert 5 reward rows directly. addReward() triggers opportunistic
    // syncAll() which would push+mark all 5 before our spy is installed —
    // bypass it by writing the rows by hand.
    for (let i = 0; i < 5; i++) {
      await db.runAsync(
        "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (?, 'coin', 1, ?, 0)",
        1, `Baca ${i + 1}`
      );
    }

    const unsynced = await rewardsLib.getUnsyncedRewards(1);
    expect(unsynced.length).toBe(5);

    // Simulate the force-kill by wrapping db.runAsync: allow the first 2
    // "UPDATE reward_history SET synced = 1" statements through, then throw
    // on the 3rd. Restored after the first syncAll so the recovery path
    // runs normally.
    const origRun = db.runAsync.bind(db);
    let markUpdateCount = 0;
    (db as any).runAsync = async (sql: string, ...params: any[]) => {
      if (/UPDATE reward_history SET synced = 1/.test(sql)) {
        markUpdateCount++;
        if (markUpdateCount === 3) {
          throw new Error("simulated kill mid-markRewardsSynced");
        }
      }
      return origRun(sql, ...params);
    };

    // First syncAll: push succeeds server-side (all 5 land), markRewardsSynced
    // throws mid-way. Rows 1,2 are synced=1 locally; rows 3,4,5 stay synced=0.
    const report1 = await sync.syncAll([1]);

    expect(mockCounters.pushCallCount).toBe(1);
    expect(serverState.rewards[1].length).toBe(5);
    expect(report1.errors.some((e) => /simulated kill/.test(e))).toBe(true);

    const afterFirst = await db.getAllAsync<{ id: number; synced: number; idempotency_key: string | null }>(
      "SELECT id, synced, idempotency_key FROM reward_history WHERE child_id = 1 ORDER BY id"
    );
    // Critical MC-3 invariant: NO duplicate rows from the pull+merge step.
    // Pre-fix, mergeServerRewards would insert 3 ghost copies (one per
    // unmarked row) because those rows had no idempotency_key to dedupe on.
    expect(afterFirst.length).toBe(5);
    expect(afterFirst.filter((r) => r.synced === 1).length).toBe(2);
    expect(afterFirst.filter((r) => r.synced === 0).length).toBe(3);
    // Every row must carry its idempotency_key so the next pull dedupes.
    expect(afterFirst.every((r) => !!r.idempotency_key)).toBe(true);

    // Restore db.runAsync for the recovery run.
    (db as any).runAsync = origRun;

    // Second syncAll: picks up rows 3,4,5. Re-pushes with same idempotency_keys.
    // Server dedupes (already present). Rows get marked synced.
    const report2 = await sync.syncAll([1]);

    expect(report2.success).toBe(true);
    expect(mockCounters.pushCallCount).toBe(2);
    // Server must NOT have duplicates.
    expect(serverState.rewards[1].length).toBe(5);

    const afterSecond = await db.getAllAsync<{ synced: number }>(
      "SELECT synced FROM reward_history WHERE child_id = 1"
    );
    expect(afterSecond.every((r) => r.synced === 1)).toBe(true);

    // Balance masih benar.
    const row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(row?.coins).toBe(5);
  });
});
