/**
 * E2E sync tests against a real local Django backend.
 *
 * Spun up by scripts/e2e-backend.sh on port 8124 with an isolated
 * sqlite DB at /tmp/hayya-baca-e2e.sqlite3. DO NOT run via `npm test` —
 * use `npm run test:e2e` which handles lifecycle + cleanup.
 *
 * Purpose: prove the HTTP layer + DRF serializers + ORM round-trip
 * actually works. Use-case tests (with mocked api) cover client logic;
 * these cover the parts only a real server can break.
 */
import Database from "better-sqlite3";

// --- Wire better-sqlite3 as the expo-sqlite mock so api.ts can stash
// the auth token + device_id in a real table. ---
let mockTestDb: ReturnType<typeof Database>;

function mockCreateTestDb() {
  mockTestDb = new Database(":memory:");
  mockTestDb.pragma("journal_mode = WAL");
  return {
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
}

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn().mockImplementation(async () => mockCreateTestDb()),
}));

jest.mock("expo-device", () => ({ modelName: "E2E Device" }));

// api.ts reads apiBaseUrl from Constants.expoConfig.extra, set by e2e.setup.ts
// (which picks up API_BASE_URL from the harness script env).
// NOTE: do NOT mock ../lib/api here — we want real fetch calls.

// Each test gets a fresh DB + device id. Reset between tests.
let mockCurrentDeviceId = "e2e-device-unset";
jest.mock("expo-crypto", () => ({
  randomUUID: () => mockCurrentDeviceId,
}));

const CREDS = { username: "e2e", password: "e2e-password" };

async function resetBackendData() {
  // Wipe reward + progress + child rows via a custom reset endpoint?
  // We don't have one — fall back to deleting via Django shell is out of
  // scope. Instead, each test uses a fresh child name so data doesn't
  // collide, and asserts against child-scoped queries.
  // If state needs wiping between runs, re-invoke the harness script.
}

beforeEach(async () => {
  if (mockTestDb) {
    try {
      mockTestDb.close();
    } catch {}
  }
  jest.resetModules();
  jest.clearAllMocks();
  mockCurrentDeviceId = `e2e-device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await resetBackendData();
});

afterAll(() => {
  if (mockTestDb) {
    try {
      mockTestDb.close();
    } catch {}
  }
});

async function loginHelper() {
  const api = require("../lib/api") as typeof import("../lib/api");
  await api.login(CREDS.username, CREDS.password);
  return api;
}

describe("E2E sync against real Django backend", () => {
  it("Case 1 — smoke: login succeeds and returns a usable token", async () => {
    const api = await loginHelper();
    expect(await api.isLoggedIn()).toBe(true);
    // Authed call should not 401.
    const children = await api.fetchChildren();
    expect(Array.isArray(children)).toBe(true);
  });

  it("Case 2 — createChildOnServer round-trips name/age/color", async () => {
    const api = await loginHelper();
    const name = `Case2-${Date.now()}`;
    const created = await api.createChildOnServer(name, 7, "#33AA55");
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe(name);
    expect(created.age).toBe(7);
    expect(created.avatar_color).toBe("#33AA55");

    const list = await api.fetchChildren();
    expect(list.some((c) => c.id === created.id)).toBe(true);
  });

  it("Case 3 — pushRewardsBulk + fetchRewardHistory round-trip", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`Case3-${Date.now()}`);
    const key = `e2e-case3-${Date.now()}`;
    const err = await api.pushRewardsBulk(child.id, [
      { type: "coin", count: 5, description: "Baca buku", created_at: new Date().toISOString(), idempotency_key: key },
      { type: "star", count: 2, description: "Halaman bagus", created_at: new Date().toISOString(), idempotency_key: `${key}-2` },
    ]);
    expect(err).toBeNull();

    const history = await api.fetchRewardHistory(child.id);
    const keys = history.map((h) => h.idempotency_key);
    expect(keys).toContain(key);
    expect(keys).toContain(`${key}-2`);
    expect(history.find((h) => h.idempotency_key === key)?.count).toBe(5);
  });

  it("Case 4 — Bug #9: coin_spend accepted by server serializer", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`Case4-${Date.now()}`);
    const now = new Date().toISOString();
    const err = await api.pushRewardsBulk(child.id, [
      { type: "coin", count: 50, description: "Earn", created_at: now, idempotency_key: `e2e-c4-earn-${Date.now()}` },
      { type: "coin_spend", count: -20, description: "Beli game", created_at: now, idempotency_key: `e2e-c4-spend-${Date.now()}` },
    ]);
    expect(err).toBeNull();

    const history = await api.fetchRewardHistory(child.id);
    const spend = history.find((h) => h.type === "coin_spend");
    expect(spend).toBeDefined();
    expect(spend?.count).toBe(-20);
  });

  it("Case 5 — pushReadingProgress + fetchReadingProgressFromServer", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`Case5-${Date.now()}`);

    const e1 = await api.pushReadingProgress(child.id, {
      book: "1",
      last_page: 3,
      completed: false,
      completed_count: 0,
    });
    expect(e1).toBeNull();

    const e2 = await api.pushReadingProgress(child.id, {
      book: "1",
      last_page: 12,
      completed: false,
      completed_count: 0,
    });
    expect(e2).toBeNull();

    const rows = await api.fetchReadingProgressFromServer(child.id);
    const book1 = rows.find((r) => r.book === "1");
    expect(book1).toBeDefined();
    // Server should hold the latest push (or max — either way ≥12).
    expect(book1!.last_page).toBeGreaterThanOrEqual(12);
  });

  it("Case 6 — idempotency: same reward pushed twice does not duplicate", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`Case6-${Date.now()}`);
    const key = `e2e-c6-dupe-${Date.now()}`;
    const payload = {
      type: "coin",
      count: 3,
      description: "Dupe test",
      created_at: new Date().toISOString(),
      idempotency_key: key,
    };

    expect(await api.pushRewardsBulk(child.id, [payload])).toBeNull();
    expect(await api.pushRewardsBulk(child.id, [payload])).toBeNull();

    const history = await api.fetchRewardHistory(child.id);
    const matches = history.filter((h) => h.idempotency_key === key);
    expect(matches.length).toBe(1);
  });

  it("Case 7 — device telemetry piggybacks on push without error", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`Case7-${Date.now()}`);
    const err = await api.pushRewardsBulk(
      child.id,
      [
        {
          type: "coin",
          count: 1,
          description: "telemetry",
          created_at: new Date().toISOString(),
          idempotency_key: `e2e-c7-${Date.now()}`,
        },
      ],
      {
        device_id: mockCurrentDeviceId,
        app_version: "0.0.0-e2e",
        queue_depth_rewards: 0,
        queue_depth_progress: 0,
        last_successful_sync_at: new Date().toISOString(),
        last_sync_error: null,
      }
    );
    expect(err).toBeNull();
    // Pushing again upserts — should still succeed without unique violation.
    const err2 = await api.pushRewardsBulk(
      child.id,
      [
        {
          type: "coin",
          count: 1,
          description: "telemetry2",
          created_at: new Date().toISOString(),
          idempotency_key: `e2e-c7-b-${Date.now()}`,
        },
      ],
      {
        device_id: mockCurrentDeviceId,
        app_version: "0.0.0-e2e",
        queue_depth_rewards: 0,
        queue_depth_progress: 0,
        last_successful_sync_at: new Date().toISOString(),
        last_sync_error: "transient failure earlier",
      }
    );
    expect(err2).toBeNull();
  });
});
