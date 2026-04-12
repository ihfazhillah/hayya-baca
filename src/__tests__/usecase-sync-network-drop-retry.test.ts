/**
 * OL-1 — Mid-push network drop (blank spot).
 *
 * Skenario: mama drive, tablet online sebentar, push start, masuk
 * underpass, signal drop. Worst sub-case: server SUDAH commit sebagian/
 * semua row, tapi response balik lost → client catch network error → TIDAK
 * mark synced. Next sync harus re-push dengan key yang sama, server dedupe,
 * lokal converge tanpa dupe dan tanpa data loss.
 *
 * Invariant: setelah recovery, total lokal = total server = jumlah original,
 * semua synced=1, coins akurat. Test fault-inject `fetch` langsung (bukan
 * mock `pushRewardsBulk`) sehingga path `api.ts` tetap ter-exercise.
 *
 * Spec: specs/01-sync-problem/edge-cases.md §OL-1. Spec menandai case ini
 * "mitigated by idempotency" — test ini adalah regression guard untuk
 * memastikan invariant tetap dipenuhi bersama fix MC-3.
 */

import Database from "better-sqlite3";

let mockTestDb: ReturnType<typeof Database>;

const mockCounters = { fetchCallCount: 0, pushAttemptCount: 0 };

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

// In-memory "server" that the mocked fetch talks to.
const serverStore: {
  rewards: { type: string; count: number; description: string; created_at: string; idempotency_key: string }[];
} = { rewards: [] };

beforeEach(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
  jest.resetModules();
  jest.clearAllMocks();
  serverStore.rewards = [];
  mockCounters.fetchCallCount = 0;
  mockCounters.pushAttemptCount = 0;
});

afterAll(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
});

describe("OL-1: network drop mid-push is recoverable on next syncAll", () => {
  it("server commits, response lost → retry dedupes, no dupes, no data loss", async () => {
    // Hijack global fetch. Route /rewards/sync/ through serverStore; first
    // rewards push commits server-side then throws a network error. Other
    // endpoints return empty-but-valid JSON so the sync pipeline can
    // proceed to later steps without crashing.
    (global as any).fetch = jest.fn(async (url: string, init?: any) => {
      mockCounters.fetchCallCount++;
      const u = String(url);
      const method = (init?.method || "GET").toUpperCase();

      if (u.includes("/rewards/sync/") && method === "POST") {
        mockCounters.pushAttemptCount++;
        const body = JSON.parse(init.body);
        let created = 0;
        let skipped = 0;
        for (const r of body.rewards) {
          if (serverStore.rewards.some((x) => x.idempotency_key === r.idempotency_key)) {
            skipped++;
            continue;
          }
          serverStore.rewards.push(r);
          created++;
        }
        // First attempt: commit succeeded, but response is lost mid-flight.
        if (mockCounters.pushAttemptCount === 1) {
          throw new TypeError("Network request failed");
        }
        return new Response(JSON.stringify({ detail: "Synced", created, skipped }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (u.includes("/children/") && u.endsWith("/rewards/") && method === "GET") {
        return new Response(JSON.stringify(serverStore.rewards), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (u.endsWith("/children/") && method === "GET") {
        return new Response(JSON.stringify([
          { id: 1, name: "Sakinah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
        ]), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (u.includes("/reading/") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (u.includes("/progress/") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (u.includes("/reading-log/") && method === "POST") {
        return new Response(JSON.stringify({ created: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Default: 200 empty
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const sync = require("../lib/sync") as typeof import("../lib/sync");
    const database = require("../lib/database") as typeof import("../lib/database");
    const rewardsLib = require("../lib/rewards") as typeof import("../lib/rewards");

    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "Sakinah", "#E91E63", 1
    );
    // Fake login so isLoggedIn() returns true.
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_token', 'fake-token')");

    // Seed 5 unsynced rewards directly.
    for (let i = 0; i < 5; i++) {
      await db.runAsync(
        "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (?, 'coin', 1, ?, 0)",
        1, `Baca ${i + 1}`
      );
    }

    // First syncAll: push commits on server but fetch throws after write.
    // No rows get marked locally.
    const report1 = await sync.syncAll([1]);

    expect(mockCounters.pushAttemptCount).toBe(1);
    expect(serverStore.rewards.length).toBe(5);
    expect(report1.success).toBe(false);
    expect(report1.errors.some((e) => /Network|failed/i.test(e))).toBe(true);

    const afterFirst = await db.getAllAsync<{ synced: number; idempotency_key: string | null }>(
      "SELECT synced, idempotency_key FROM reward_history WHERE child_id = 1"
    );
    // Critical invariant: no merge-dupes. Pre-MC-3-fix this would be 10
    // because mergeServerRewards couldn't dedupe rows with no local key.
    expect(afterFirst.length).toBe(5);
    expect(afterFirst.every((r) => r.synced === 0)).toBe(true);
    // Keys must already be persisted (the MC-3 fix).
    expect(afterFirst.every((r) => !!r.idempotency_key)).toBe(true);

    // Second syncAll: push succeeds this time. Server dedupes all 5.
    const report2 = await sync.syncAll([1]);

    expect(mockCounters.pushAttemptCount).toBe(2);
    expect(report2.success).toBe(true);
    // Server still has exactly 5 (retry dedup).
    expect(serverStore.rewards.length).toBe(5);

    const afterSecond = await db.getAllAsync<{ synced: number }>(
      "SELECT synced FROM reward_history WHERE child_id = 1"
    );
    expect(afterSecond.length).toBe(5);
    expect(afterSecond.every((r) => r.synced === 1)).toBe(true);

    const child = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = 1");
    expect(child?.coins).toBe(5);
  });
});
