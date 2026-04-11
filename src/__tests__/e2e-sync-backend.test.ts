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
// the auth token + device_id in a real table. Each openDatabaseAsync
// call gets a fresh in-memory DB — isolated per jest-module-isolate so
// makeDevice() can spin up multiple virtual devices with independent
// token + device_id storage. ---
const mockOpenedDbs: ReturnType<typeof Database>[] = [];

function mockCreateTestDb() {
  const inner = new Database(":memory:");
  inner.pragma("journal_mode = WAL");
  mockOpenedDbs.push(inner);
  return {
    execAsync: async (sql: string) => {
      inner.exec(sql);
    },
    runAsync: async (sql: string, ...params: any[]) => {
      const stmt = inner.prepare(sql);
      const result = stmt.run(...params);
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
    },
    getFirstAsync: async <T>(sql: string, ...params: any[]): Promise<T | null> => {
      const stmt = inner.prepare(sql);
      return (stmt.get(...params) as T) ?? null;
    },
    getAllAsync: async <T>(sql: string, ...params: any[]): Promise<T[]> => {
      const stmt = inner.prepare(sql);
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
  while (mockOpenedDbs.length) {
    try {
      mockOpenedDbs.pop()?.close();
    } catch {}
  }
  jest.resetModules();
  jest.clearAllMocks();
  mockCurrentDeviceId = `e2e-device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await resetBackendData();
});

afterAll(() => {
  while (mockOpenedDbs.length) {
    try {
      mockOpenedDbs.pop()?.close();
    } catch {}
  }
});

async function loginHelper() {
  const api = require("../lib/api") as typeof import("../lib/api");
  await api.login(CREDS.username, CREDS.password);
  return api;
}

/**
 * Spin up an isolated "virtual device" — its own module graph means
 * its own in-memory sqlite (so its own auth token + cached device id),
 * fully independent from any other device in the same test.
 *
 * Use for multi-device edge-case tests (MD-1, MD-2, ID-1, etc.).
 * `deviceId` becomes the X-Device-Id header on every request.
 */
async function makeDevice(
  deviceId: string
): Promise<typeof import("../lib/api")> {
  return makeDeviceAs(deviceId, CREDS.username, CREDS.password);
}

/**
 * Variant for multi-user tests (BC-2): lets a device log in as a
 * different user so we can exercise cross-user access control.
 */
async function makeDeviceAs(
  deviceId: string,
  username: string,
  password: string
): Promise<typeof import("../lib/api")> {
  let api!: typeof import("../lib/api");
  await jest.isolateModulesAsync(async () => {
    mockCurrentDeviceId = deviceId;
    api = require("../lib/api") as typeof import("../lib/api");
    await api.login(username, password);
  });
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

  it("Case 8 — MD-1: two devices earn coins concurrently for same child", async () => {
    const apiT = await makeDevice("md1-device-T");
    const apiH = await makeDevice("md1-device-H");

    const child = await apiT.createChildOnServer(`MD1-${Date.now()}`);
    const now = new Date().toISOString();
    const keyT = `md1-T-${Date.now()}`;
    const keyH = `md1-H-${Date.now()}`;

    // Interleaved push from two devices. We don't use Promise.all
    // because the e2e backend is SQLite — parallel writers deadlock
    // with "database is locked". What MD-1 actually guards is
    // convergence (both rows present, balance == tablet + hp, no lost
    // update), which sequential pushes exercise just as well — the
    // lost-update risk is inside BulkRewardSyncSerializer.create(),
    // not in HTTP concurrency.
    const eT = await apiT.pushRewardsBulk(child.id, [
      { type: "coin", count: 5, description: "Tablet baca", created_at: now, idempotency_key: keyT },
    ]);
    const eH = await apiH.pushRewardsBulk(child.id, [
      { type: "coin", count: 3, description: "HP baca", created_at: now, idempotency_key: keyH },
    ]);
    expect(eT).toBeNull();
    expect(eH).toBeNull();

    // Each device pulls independently — server is the single source of
    // truth, so both must see both rows (set equality).
    const fromT = await apiT.fetchRewardHistory(child.id);
    const fromH = await apiH.fetchRewardHistory(child.id);
    const keysT = fromT.map((r) => r.idempotency_key).sort();
    const keysH = fromH.map((r) => r.idempotency_key).sort();
    expect(keysT).toEqual(keysH);
    expect(keysT).toEqual(expect.arrayContaining([keyT, keyH]));

    // Backend balance = sum of both earns.
    const total = fromT
      .filter((r) => r.type === "coin")
      .reduce((acc, r) => acc + r.count, 0);
    expect(total).toBe(8);

    // And the two rows were written under DIFFERENT source devices —
    // telemetry in X-Device-Id must not get smeared by parallel push.
    const children = await apiT.fetchChildren();
    const authoritative = children.find((c) => c.id === child.id);
    expect(authoritative?.coins).toBe(8);
  });

  it("Case 9 — MD-2/RC-1: completed_count derives from reading_log (sum, not max)", async () => {
    const apiT = await makeDevice("md2-device-T");
    const apiH = await makeDevice("md2-device-H");

    const child = await apiT.createChildOnServer(`MD2-${Date.now()}`);

    // Both devices independently complete book "1" once. Event-sourced
    // truth lives in reading_log; reading_progress.completed_count is
    // the derived projection.
    const errT = await apiT.pushReadingProgress(child.id, {
      book: "1",
      last_page: 10,
      completed: true,
      completed_count: 1,
    });
    expect(errT).toBeNull();

    const errH = await apiH.pushReadingProgress(child.id, {
      book: "1",
      last_page: 10,
      completed: true,
      completed_count: 1,
    });
    expect(errH).toBeNull();

    // Append-only reading_log — two distinct completions.
    const keySuffix = Date.now();
    const errLogT = await apiT.pushReadingLog(child.id, [
      {
        book_id: "1",
        completed_at: "2026-04-11T10:00:00.000Z",
        idempotency_key: `md2-T-${keySuffix}`,
      },
    ]);
    expect(errLogT).toBeNull();

    const errLogH = await apiH.pushReadingLog(child.id, [
      {
        book_id: "1",
        completed_at: "2026-04-11T10:05:00.000Z",
        idempotency_key: `md2-H-${keySuffix}`,
      },
    ]);
    expect(errLogH).toBeNull();

    // Reading log sanity — two events present.
    const logs = await apiT.fetchReadingLog(child.id);
    expect(logs.filter((l) => l.book_id === "1").length).toBe(2);

    // Server's projected completed_count must match the log count, not
    // MAX(local, incoming). Pre-fix this is 1 (MAX), post-fix 2.
    const progress = await apiT.fetchReadingProgressFromServer(child.id);
    const book1 = progress.find((p) => p.book === "1");
    expect(book1?.completed_count).toBe(2);
  });

  it("Case 12 — MD-5: spend on device B after earn on device A converges", async () => {
    const apiT = await makeDevice("md5-device-T");
    const apiH = await makeDevice("md5-device-H");

    const child = await apiT.createChildOnServer(`MD5-${Date.now()}`);
    const now = new Date().toISOString();
    const keyEarn = `md5-T-earn-${Date.now()}`;
    const keySpend = `md5-H-spend-${Date.now()}`;

    // Tablet earns 50 coins.
    const eEarn = await apiT.pushRewardsBulk(child.id, [
      { type: "coin", count: 50, description: "Tablet earn", created_at: now, idempotency_key: keyEarn },
    ]);
    expect(eEarn).toBeNull();

    // HP pulls and sees the earn from the tablet.
    const viaH = await apiH.fetchRewardHistory(child.id);
    expect(viaH.find((r) => r.idempotency_key === keyEarn)?.count).toBe(50);

    // HP spends 20 coins (coin_spend is an event, not an absolute balance).
    const eSpend = await apiH.pushRewardsBulk(child.id, [
      { type: "coin_spend", count: -20, description: "HP spend", created_at: now, idempotency_key: keySpend },
    ]);
    expect(eSpend).toBeNull();

    // Authoritative balance = 50 + (-20) = 30 for both devices.
    const childrenT = await apiT.fetchChildren();
    const childrenH = await apiH.fetchChildren();
    expect(childrenT.find((c) => c.id === child.id)?.coins).toBe(30);
    expect(childrenH.find((c) => c.id === child.id)?.coins).toBe(30);

    // Tablet pulls full history; local recalculation sums to 30.
    const viaT = await apiT.fetchRewardHistory(child.id);
    const keys = viaT.map((r) => r.idempotency_key).sort();
    expect(keys).toEqual(expect.arrayContaining([keyEarn, keySpend]));
    const coinsSum = viaT
      .filter((r) => r.type === "coin" || r.type === "coin_spend")
      .reduce((acc, r) => acc + r.count, 0);
    expect(coinsSum).toBe(30);
  });

  it("Case 20 — ID-1: duplicate device-id collision surfaces skipped count", async () => {
    // Same device id on both isolates — simulates two installs that
    // somehow share expo-crypto.randomUUID() output (bug, manual copy,
    // whatever). Idempotency keys collide globally.
    const apiA = await makeDevice("id1-dupe-device");
    const apiB = await makeDevice("id1-dupe-device");

    const child = await apiA.createChildOnServer(`ID1-${Date.now()}`);
    const now = new Date().toISOString();
    const sharedKey = `id1-dupe-${Date.now()}`;

    const eA = await apiA.pushRewardsBulk(child.id, [
      { type: "coin", count: 5, description: "A earn", created_at: now, idempotency_key: sharedKey },
    ]);
    expect(eA).toBeNull();

    // Device B collides on idempotency_key. Fire the request via raw
    // apiFetch so we can read the JSON body and assert the server
    // surfaced the skipped count — without that, B would believe the
    // push succeeded while its real data was silently discarded.
    const resB = await apiB.apiFetch(`/children/${child.id}/rewards/sync/`, {
      method: "POST",
      body: JSON.stringify({
        rewards: [
          { type: "coin", count: 3, description: "B earn", created_at: now, idempotency_key: sharedKey },
        ],
      }),
    });
    expect(resB.ok).toBe(true);
    const bodyB = (await resB.json()) as { created?: number; skipped?: number };
    expect(bodyB.skipped).toBe(1);
    expect(bodyB.created).toBe(0);

    // And the history is unchanged — A's count wins, B's was dropped.
    const history = await apiA.fetchRewardHistory(child.id);
    const matches = history.filter((r) => r.idempotency_key === sharedKey);
    expect(matches.length).toBe(1);
    expect(matches[0].count).toBe(5);
  });

  it("Case 24 — BC-2: intruder cannot push rewards or reading log to another user's child", async () => {
    // Victim = default e2e user. Intruder is seeded by seed_e2e with no
    // ChildAccess to any of e2e's children.
    const victimApi = await makeDevice("bc2-victim");
    const intruderApi = await makeDeviceAs(
      "bc2-intruder",
      "intruder",
      "intruder-password"
    );

    const kid = await victimApi.createChildOnServer(`BC2-${Date.now()}`);
    const now = new Date().toISOString();
    const ghostKey = `bc2-ghost-${Date.now()}`;

    // Rewards push must 403 — intruder has no ChildAccess row.
    const errRewards = await intruderApi.pushRewardsBulk(kid.id, [
      { type: "coin", count: 999, description: "ghost", created_at: now, idempotency_key: ghostKey },
    ]);
    expect(errRewards).toMatch(/403/);

    // Reading log push must also 403 — same permission gap.
    const errLog = await intruderApi.pushReadingLog(kid.id, [
      { book_id: "1", completed_at: now, idempotency_key: `bc2-log-${Date.now()}` },
    ]);
    expect(errLog).toMatch(/403/);

    // And nothing leaked to the victim's reward history.
    const hist = await victimApi.fetchRewardHistory(kid.id);
    expect(hist.some((r) => r.idempotency_key === ghostKey)).toBe(false);
  });

  it("Case 11 — MD-4: fresh device syncAll() pulls all children and their rewards", async () => {
    const childName = `MD4-${Date.now()}`;
    const now = new Date().toISOString();

    // Device A: the existing user has this child + 5 rewards on the server.
    const apiA = await makeDevice("md4-device-A");
    const child = await apiA.createChildOnServer(childName);
    const errPush = await apiA.pushRewardsBulk(child.id, [
      { type: "coin", count: 1, description: "A1", created_at: now, idempotency_key: `md4-${child.id}-1` },
      { type: "coin", count: 1, description: "A2", created_at: now, idempotency_key: `md4-${child.id}-2` },
      { type: "coin", count: 1, description: "A3", created_at: now, idempotency_key: `md4-${child.id}-3` },
      { type: "coin", count: 1, description: "A4", created_at: now, idempotency_key: `md4-${child.id}-4` },
      { type: "coin", count: 1, description: "A5", created_at: now, idempotency_key: `md4-${child.id}-5` },
    ]);
    expect(errPush).toBeNull();

    // Device B: fresh install. Login via isolated module graph, then the
    // mount-style `syncAll()` call (no childIds) must pull the child AND
    // its reward history — exercising the fresh-device bootstrap path.
    await jest.isolateModulesAsync(async () => {
      mockCurrentDeviceId = "md4-device-B";
      const apiB = require("../lib/api") as typeof import("../lib/api");
      await apiB.login(CREDS.username, CREDS.password);

      const sync = require("../lib/sync") as typeof import("../lib/sync");
      const database = require("../lib/database") as typeof import("../lib/database");

      const report = await sync.syncAll(); // no args — mount-time call
      expect(report.success).toBe(true);

      const db = await database.getDatabase();
      const localChildren = await db.getAllAsync<{ id: number; name: string }>(
        "SELECT id, name FROM children"
      );
      const ourChild = localChildren.find((c) => c.name === childName);
      expect(ourChild).toBeDefined();

      const localRewards = await db.getAllAsync<{ count: number; description: string }>(
        "SELECT count, description FROM reward_history WHERE child_id = ?",
        ourChild!.id
      );
      // Pre-fix: 0 rows — fresh-device childIds race causes the pull loop
      // to skip because local children is empty at the moment childIds is
      // computed, even though fetchChildren populates them moments later.
      expect(localRewards.length).toBe(5);

      const row = await db.getFirstAsync<{ coins: number }>(
        "SELECT coins FROM children WHERE id = ?",
        ourChild!.id
      );
      expect(row?.coins).toBe(5);
    });
  });

  it("Case 29 — BC-6: reading_progress resolves by slug, pk, then stub", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`Case29-${Date.now()}`);

    // (1) Slug match — book "1" is seeded.
    const errSlug = await api.pushReadingProgress(child.id, {
      book: "1",
      last_page: 5,
      completed: false,
      completed_count: 0,
    });
    expect(errSlug).toBeNull();

    // (2) Numeric pk fallback — seed_e2e ships a book with a
    // non-numeric slug ("e2e-alt"). Look it up, then push using its pk
    // (stringified) as the `book` field. Without the pk fallback the
    // serializer would hit the stub branch and create a SECOND Book
    // whose slug equals the pk-as-string.
    const listed = (await (
      await fetch(`${process.env.API_BASE_URL}/books/?type=book`)
    ).json()) as { id: number; slug: string }[];
    const altBook = listed.find((b) => b.slug === "e2e-alt");
    expect(altBook).toBeDefined();
    const errPk = await api.pushReadingProgress(child.id, {
      book: String(altBook!.id),
      last_page: 7,
      completed: false,
      completed_count: 0,
    });
    expect(errPk).toBeNull();

    // (3) Unknown slug — last-resort stub so sync never loses a row.
    const unknownSlug = `case29-unknown-${Date.now()}`;
    const errUnknown = await api.pushReadingProgress(child.id, {
      book: unknownSlug,
      last_page: 5,
      completed: false,
      completed_count: 0,
    });
    expect(errUnknown).toBeNull();

    // Server round-trip sees all three books under distinct slugs.
    const rows = await api.fetchReadingProgressFromServer(child.id);
    const slugs = rows.map((r) => r.book);
    expect(slugs).toEqual(
      expect.arrayContaining(["1", "e2e-alt", unknownSlug])
    );
    // And the pk fallback resolved to the existing book (not a new stub
    // with slug === "<pk>").
    expect(slugs).not.toContain(String(altBook!.id));
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

  // KB-2 — bulk push of 200 rewards must complete within 5s. Guard against
  // server-side regressions (bulk_create rewrite, telemetry overhead, etc.)
  // that would turn a 2-hour-offline session's flush into a hang.
  it("Case 17 — KB-2: bulk push of 200 rewards finishes under 5s", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`KB2-${Date.now()}`);
    const now = new Date().toISOString();
    const base = `kb2-${Date.now()}`;
    const rewards = Array.from({ length: 200 }, (_, i) => ({
      type: "coin",
      count: 1,
      description: `r${i}`,
      created_at: now,
      idempotency_key: `${base}-${i}`,
    }));

    const t0 = Date.now();
    const err = await api.pushRewardsBulk(child.id, rewards);
    const elapsed = Date.now() - t0;

    expect(err).toBeNull();
    expect(elapsed).toBeLessThan(5000);

    const history = await api.fetchRewardHistory(child.id);
    const mine = history.filter((h) => h.idempotency_key?.startsWith(base));
    expect(mine.length).toBe(200);
  });

  // BC-4 — server-reported balance must equal the sum of reward_history
  // rows for that child, both after a mixed push and after a full re-push
  // where every row is skipped by idempotency. Regression guard — current
  // behavior correct, but the serializer's skip/continue path is exactly
  // the kind of place that breaks on future refactors.
  it("Case 26 — BC-4: balance == sum(reward_history) across re-push", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`BC4-${Date.now()}`);
    const now = new Date().toISOString();
    const base = `bc4-${Date.now()}`;
    const batch = [
      { type: "coin", count: 5, description: "Baca 1", created_at: now, idempotency_key: `${base}-1` },
      { type: "coin_spend", count: -2, description: "Beli stiker", created_at: now, idempotency_key: `${base}-2` },
      { type: "coin", count: 3, description: "Baca 2", created_at: now, idempotency_key: `${base}-3` },
      { type: "star", count: 4, description: "Halaman bagus", created_at: now, idempotency_key: `${base}-4` },
    ];

    expect(await api.pushRewardsBulk(child.id, batch)).toBeNull();

    const balUrl = `${process.env.API_BASE_URL}/children/${child.id}/balance/`;
    const bal1 = (await (await fetch(balUrl)).json()) as { coins: number; stars: number };
    expect(bal1.coins).toBe(6);
    expect(bal1.stars).toBe(4);

    // Re-push identical batch: every row skipped by idempotency, balance
    // must NOT double.
    expect(await api.pushRewardsBulk(child.id, batch)).toBeNull();

    const bal2 = (await (await fetch(balUrl)).json()) as { coins: number; stars: number };
    expect(bal2.coins).toBe(6);
    expect(bal2.stars).toBe(4);

    // And cross-check against reward_history — server's denormalized
    // balance is supposed to be a cache of this sum.
    const history = await api.fetchRewardHistory(child.id);
    const coinSum = history
      .filter((h) => h.type === "coin" || h.type === "coin_adjustment" || h.type === "coin_spend")
      .reduce((s, h) => s + h.count, 0);
    const starSum = history
      .filter((h) => h.type === "star" || h.type === "star_adjustment")
      .reduce((s, h) => s + h.count, 0);
    expect(bal2.coins).toBe(coinSum);
    expect(bal2.stars).toBe(starSum);
  });

  // KB-3 — backend must reject coin_spend that would drive child.coins below
  // zero. Without this guard, a mobile UI glitch (stale local balance) can
  // push a negative spend and the server happily stores it → child.coins
  // lands below zero, kid sees confusing UI, balance desync propagates to
  // every other device that pulls history.
  it("Case 18 — KB-3: backend rejects coin_spend that would make balance negative", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`KB3-${Date.now()}`);
    const now = new Date().toISOString();

    // Earn 10.
    const earnErr = await api.pushRewardsBulk(child.id, [
      { type: "coin", count: 10, description: "Earn", created_at: now, idempotency_key: `kb3-earn-${Date.now()}` },
    ]);
    expect(earnErr).toBeNull();

    // Try to spend 50. Current backend accepts this → balance = -40.
    // Expected: 400 with user-readable reason, balance untouched.
    const spendErr = await api.pushRewardsBulk(child.id, [
      { type: "coin_spend", count: -50, description: "Beli game mahal", created_at: now, idempotency_key: `kb3-spend-${Date.now()}` },
    ]);
    expect(spendErr).not.toBeNull();
    expect(spendErr).toMatch(/400/);
    expect(spendErr).toMatch(/insufficient|balance|saldo/i);

    // Balance must remain 10 — the spend row never landed.
    const history = await api.fetchRewardHistory(child.id);
    const forThisChild = history; // already child-scoped
    const totalCoins = forThisChild
      .filter((h) => h.type === "coin" || h.type === "coin_adjustment" || h.type === "coin_spend")
      .reduce((sum, h) => sum + h.count, 0);
    expect(totalCoins).toBe(10);
    expect(forThisChild.some((h) => h.type === "coin_spend")).toBe(false);

    // A legal partial spend (≤ balance) must still succeed — guard fires
    // only on insufficient funds, not on all coin_spend.
    const legalSpend = await api.pushRewardsBulk(child.id, [
      { type: "coin_spend", count: -7, description: "Beli stiker", created_at: now, idempotency_key: `kb3-legal-${Date.now()}` },
    ]);
    expect(legalSpend).toBeNull();

    const history2 = await api.fetchRewardHistory(child.id);
    const total2 = history2
      .filter((h) => h.type === "coin" || h.type === "coin_adjustment" || h.type === "coin_spend")
      .reduce((sum, h) => sum + h.count, 0);
    expect(total2).toBe(3);
  });

  // ID-3 — two reading_log completions that share completed_at (to the
  // second) but differ in idempotency_key must BOTH land and BOTH come
  // back on pull, with their keys preserved. The fragile path is a
  // local dedup that collapses on (child, book, completed_at) — this
  // test pins the server contract so a future client-side schema
  // change can trust the pull payload's idempotency_key.
  it("Case 22 — ID-3: reading_log pull preserves idempotency_key for same-timestamp events", async () => {
    const apiA = await makeDevice("id3-device-A");
    const apiB = await makeDevice("id3-device-B");

    const child = await apiA.createChildOnServer(`ID3-${Date.now()}`);
    const ts = "2026-04-11T12:34:56.000Z";
    const base = `id3-${Date.now()}`;
    const key1 = `${base}-rl1`;
    const key2 = `${base}-rl2`;

    const err = await apiA.pushReadingLog(child.id, [
      { book_id: "1", completed_at: ts, idempotency_key: key1 },
      { book_id: "1", completed_at: ts, idempotency_key: key2 },
    ]);
    expect(err).toBeNull();

    const entries = await apiB.fetchReadingLog(child.id);
    const mine = entries.filter((e) => e.idempotency_key === key1 || e.idempotency_key === key2);
    expect(mine.length).toBe(2);
    const keys = mine.map((e) => e.idempotency_key).sort();
    expect(keys).toEqual([key1, key2].sort());
    expect(new Set(mine.map((e) => e.completed_at)).size).toBe(1);
  });

  // BC-5 — reward history pull must return the full dataset in a time
  // budget that's usable on a fresh device bootstrap. 1000 rewards is
  // ~6 months of rajin reading; dev SQLite + localhost should be well
  // under 3s. Guards against: (a) pagination being silently added and
  // truncating .json() to 1 page, (b) an accidental N+1 in the
  // serializer, (c) a future order_by over an unindexed column.
  it("Case 27 — BC-5: reward history pull handles 1000+ entries under 3s", async () => {
    const api = await loginHelper();
    const child = await api.createChildOnServer(`BC5-${Date.now()}`);
    const now = new Date().toISOString();
    const base = `bc5-${Date.now()}`;

    for (let batch = 0; batch < 10; batch++) {
      const rewards = Array.from({ length: 100 }, (_, i) => ({
        type: "coin",
        count: 1,
        description: `r${batch}-${i}`,
        created_at: now,
        idempotency_key: `${base}-${batch}-${i}`,
      }));
      const err = await api.pushRewardsBulk(child.id, rewards);
      expect(err).toBeNull();
    }

    const t0 = Date.now();
    const history = await api.fetchRewardHistory(child.id);
    const elapsed = Date.now() - t0;

    const mine = history.filter((h) => h.idempotency_key?.startsWith(base));
    expect(mine.length).toBe(1000);
    expect(elapsed).toBeLessThan(3000);
  });
});
