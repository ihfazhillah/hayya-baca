/**
 * INTEGRATION TEST: Sync harus benar-benar sinkron antar device
 *
 * Beda dengan usecase-sync tests: ini pakai DB ASLI (better-sqlite3),
 * hanya mock network (API calls). Semua logic lokal (rewards, children,
 * reading_progress) jalan beneran di SQLite.
 *
 * Bugs yang harus ketangkap:
 * 1. Reward duplikat: push reward → pull dari server → insert lagi (idempotency_key tidak disimpan lokal)
 * 2. Reading progress tidak pernah di-pull dari server
 * 3. Book 404 error harus masuk report.errors tapi tidak block sync buku lain
 */

import Database from "better-sqlite3";

// --- Wire up better-sqlite3 as expo-sqlite mock ---
// Must use "mock" prefix to be allowed inside jest.mock factory
let mockTestDb: ReturnType<typeof Database>;

function mockCreateTestDb() {
  mockTestDb = new Database(":memory:");
  mockTestDb.pragma("journal_mode = WAL");

  const wrapper = {
    execAsync: async (sql: string) => {
      mockTestDb.exec(sql);
    },
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
  return wrapper;
}

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn().mockImplementation(async () => mockCreateTestDb()),
}));

jest.mock("expo-constants", () => ({
  expoConfig: { version: "0.1.0-test" },
}));

jest.mock("expo-device", () => ({
  modelName: "Test Device",
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => "test-device-id-A",
}));

// Mock ONLY the network calls in api.ts
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

import { syncAll } from "../lib/sync";
import { getDatabase } from "../lib/database";
import { addReward, saveReadingProgress } from "../lib/rewards";
import * as api from "../lib/api";

const mockApi = api as jest.Mocked<typeof api>;

async function seedChild(id: number, name: string) {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
    id, name, "#E91E63", id
  );
}

async function getChildCoins(childId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ coins: number }>(
    "SELECT coins FROM children WHERE id = ?", childId
  );
  return row?.coins ?? 0;
}

async function countRewards(childId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM reward_history WHERE child_id = ?", childId
  );
  return row?.cnt ?? 0;
}

async function getProgress(childId: number, bookId: string) {
  const db = await getDatabase();
  return db.getFirstAsync<{ last_page: number; completed: number; completed_count: number; updated_at: string }>(
    "SELECT last_page, completed, completed_count, updated_at FROM reading_progress WHERE child_id = ? AND book_id = ?",
    childId, bookId
  );
}

beforeEach(async () => {
  // Clear the database module's cached db so it re-creates
  // We need to hack into the module internals
  const dbModule = require("../lib/database") as any;
  // Reset internal state — database.ts caches db and dbPromise
  // Since we can't access them directly, we use jest.resetModules selectively
  // Actually let's just close and let it re-open
  if (mockTestDb) {
    try { mockTestDb.close(); } catch {}
  }

  // The trick: database.ts caches the db. We need to invalidate it.
  // Since database.ts uses a module-level `let db`, we can't reset it from outside.
  // Instead, we'll reset all modules and re-require.
  jest.resetModules();

  jest.clearAllMocks();
});

afterAll(() => {
  if (mockTestDb) {
    try { mockTestDb.close(); } catch {}
  }
});

// Because jest.resetModules() clears the module cache, we need to
// re-require modules in each test. Helper to get fresh modules:
function getModules() {
  const sync = require("../lib/sync") as typeof import("../lib/sync");
  const database = require("../lib/database") as typeof import("../lib/database");
  const rewards = require("../lib/rewards") as typeof import("../lib/rewards");
  const apiMod = require("../lib/api") as jest.Mocked<typeof import("../lib/api")>;
  return { syncAll: sync.syncAll, getDatabase: database.getDatabase, addReward: rewards.addReward, saveReadingProgress: rewards.saveReadingProgress, recalculateBalance: rewards.recalculateBalance, api: apiMod };
}

async function setupTest() {
  const mods = getModules();

  // Setup default mocks
  mods.api.isLoggedIn.mockResolvedValue(true);
  mods.api.fetchChildren.mockResolvedValue([
    { id: 1, name: "Sakinah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
  ]);
  mods.api.pushRewardsBulk.mockResolvedValue(null);
  mods.api.pushReadingProgress.mockResolvedValue(null);
  mods.api.pushReadingLog.mockResolvedValue(null);
  mods.api.fetchReadingLog.mockResolvedValue([]);
  mods.api.fetchRewardHistory.mockResolvedValue([]);
  if ((mods.api as any).fetchReadingProgressFromServer) {
    (mods.api as any).fetchReadingProgressFromServer.mockResolvedValue([]);
  }

  // Init DB and seed child
  const db = await mods.getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
    1, "Sakinah", "#E91E63", 1
  );

  // Helpers bound to this test's DB
  async function getCoins(childId: number): Promise<number> {
    const row = await db.getFirstAsync<{ coins: number }>("SELECT coins FROM children WHERE id = ?", childId);
    return row?.coins ?? 0;
  }
  async function rewardCount(childId: number): Promise<number> {
    const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM reward_history WHERE child_id = ?", childId);
    return row?.cnt ?? 0;
  }
  async function progress(childId: number, bookId: string) {
    return db.getFirstAsync<{ last_page: number; completed: number; completed_count: number; updated_at: string; synced: number }>(
      "SELECT last_page, completed, completed_count, updated_at, synced FROM reading_progress WHERE child_id = ? AND book_id = ?",
      childId, bookId
    );
  }

  return { ...mods, db, getCoins, rewardCount, progress };
}

describe("Bug 1: Reward duplikat setelah push+pull", () => {
  it("push 2 rewards lalu pull dari server → TIDAK duplikat, coins tetap 5", async () => {
    const t = await setupTest();

    // Anak dapat 2 coin reward lokal
    await t.addReward(1, "coin", 3, "Baca buku 1");
    await t.addReward(1, "coin", 2, "Baca buku 2");

    expect(await t.getCoins(1)).toBe(5);
    expect(await t.rewardCount(1)).toBe(2);

    // Server returns same rewards after push (with idempotency keys from this device)
    t.api.fetchRewardHistory.mockResolvedValue([
      { type: "coin", count: 3, description: "Baca buku 1", created_at: "2026-03-15T10:00:00", idempotency_key: "test-device-id-A:1" },
      { type: "coin", count: 2, description: "Baca buku 2", created_at: "2026-03-15T10:05:00", idempotency_key: "test-device-id-A:2" },
    ]);

    await t.syncAll([1]);

    // After sync: should still be 2 rewards, NOT 4
    expect(await t.rewardCount(1)).toBe(2);
    // Coins should still be 5, NOT 10
    expect(await t.getCoins(1)).toBe(5);
  });

  it("device B rewards muncul di device A setelah sync, tanpa duplikat", async () => {
    const t = await setupTest();

    await t.addReward(1, "coin", 3, "Baca buku 1");
    expect(await t.getCoins(1)).toBe(3);

    // Server returns device A's reward + device B's reward
    t.api.fetchRewardHistory.mockResolvedValue([
      { type: "coin", count: 3, description: "Baca buku 1", created_at: "2026-03-15T10:00:00", idempotency_key: "test-device-id-A:1" },
      { type: "coin", count: 5, description: "Device B baca", created_at: "2026-03-15T11:00:00", idempotency_key: "device-B:1" },
    ]);

    await t.syncAll([1]);

    expect(await t.rewardCount(1)).toBe(2); // 1 local + 1 from device B
    expect(await t.getCoins(1)).toBe(8); // 3 + 5
  });
});

describe("Bug 2: Reading progress tidak di-pull dari server", () => {
  it("device B baca halaman 10, device A sync → device A dapat halaman 10", async () => {
    const t = await setupTest();

    expect(await t.progress(1, "book-1")).toBeNull();

    // Server punya progress dari device B
    (t.api as any).fetchReadingProgressFromServer.mockResolvedValue([
      { book_id: "book-1", last_page: 10, completed: false, completed_count: 0, updated_at: "2026-03-15T11:00:00" },
    ]);

    await t.syncAll([1]);

    const p = await t.progress(1, "book-1");
    expect(p).not.toBeNull();
    expect(p?.last_page).toBe(10);
  });

  it("lokal halaman 5 (lama), server halaman 10 (baru) → ambil server", async () => {
    const t = await setupTest();

    await t.saveReadingProgress(1, "book-1", 5, false);
    await t.db.runAsync(
      "UPDATE reading_progress SET updated_at = '2026-03-14T10:00:00' WHERE child_id = 1 AND book_id = 'book-1'"
    );

    (t.api as any).fetchReadingProgressFromServer.mockResolvedValue([
      { book_id: "book-1", last_page: 10, completed: false, completed_count: 0, updated_at: "2026-03-15T11:00:00" },
    ]);

    await t.syncAll([1]);

    const p = await t.progress(1, "book-1");
    expect(p?.last_page).toBe(10);
  });

  it("lokal halaman 15 (baru), server halaman 10 (lama) → tetap lokal", async () => {
    const t = await setupTest();

    await t.saveReadingProgress(1, "book-1", 15, false);
    // updated_at is now(), which is newer than server's

    (t.api as any).fetchReadingProgressFromServer.mockResolvedValue([
      { book_id: "book-1", last_page: 10, completed: false, completed_count: 0, updated_at: "2026-03-14T10:00:00" },
    ]);

    await t.syncAll([1]);

    const p = await t.progress(1, "book-1");
    expect(p?.last_page).toBe(15);
  });
});

describe("Bug 3: Book 404 tidak block sync buku lain", () => {
  it("article-176 gagal 404, book-1 tetap sync berhasil", async () => {
    const t = await setupTest();

    await t.saveReadingProgress(1, "article-176", 3, false);
    await t.saveReadingProgress(1, "book-1", 5, true);

    t.api.pushReadingProgress.mockImplementation(async (_childId: any, data: any) => {
      if (data.book === "article-176") {
        return "pushReadingProgress 404: {\"detail\":\"Not found.\"}";
      }
      return null;
    });

    const report = await t.syncAll([1]);

    // article-176 error in report
    expect(report.errors.some((e: string) => e.includes("article-176") || e.includes("404"))).toBe(true);

    // book-1 marked synced
    const book1 = await t.progress(1, "book-1");
    expect(book1?.synced).toBe(1);

    // article-176 NOT marked synced
    const article = await t.progress(1, "article-176");
    expect(article?.synced).toBe(0);
  });
});

describe("Full round-trip: 2 device scenario", () => {
  it("device A earn coins + baca buku → sync → data dari device B masuk", async () => {
    const t = await setupTest();

    await t.addReward(1, "coin", 3, "Baca buku 1");
    await t.addReward(1, "star", 4, "Halaman bagus");
    await t.saveReadingProgress(1, "book-1", 8, false);

    expect(await t.getCoins(1)).toBe(3);

    // Server returns rewards from both devices
    t.api.fetchRewardHistory.mockResolvedValue([
      { type: "coin", count: 3, description: "Baca buku 1", created_at: "2026-03-15T10:00:00", idempotency_key: "test-device-id-A:1" },
      { type: "star", count: 4, description: "Halaman bagus", created_at: "2026-03-15T10:01:00", idempotency_key: "test-device-id-A:2" },
      { type: "coin", count: 5, description: "Device B baca", created_at: "2026-03-15T09:00:00", idempotency_key: "device-B:1" },
    ]);

    // Server returns device B's reading progress
    (t.api as any).fetchReadingProgressFromServer.mockResolvedValue([
      { book_id: "book-2", last_page: 12, completed: true, completed_count: 1, updated_at: "2026-03-15T09:30:00" },
    ]);

    const report = await t.syncAll([1]);

    expect(report.success).toBe(true);
    expect(await t.getCoins(1)).toBe(8); // 3 + 5
    expect(await t.rewardCount(1)).toBe(3); // 2 local + 1 from B, no duplicates

    const book2 = await t.progress(1, "book-2");
    expect(book2).not.toBeNull();
    expect(book2?.last_page).toBe(12);
  });
});
