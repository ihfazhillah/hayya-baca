/**
 * C4 — NetInfo reconnect trigger.
 *
 * When the device goes offline→online, queued data should flush immediately
 * instead of waiting for the next AppState foreground event. Covers the gap
 * where a user stayed in the app through a connectivity drop (e.g. subway).
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
jest.mock("expo-crypto", () => ({ randomUUID: () => "test-device-id-N" }));

type NetInfoState = { isConnected: boolean | null; isInternetReachable: boolean | null };
type Listener = (s: NetInfoState) => void;

const mockNetInfoListeners: Listener[] = [];
const mockNetInfoAddEventListener = jest.fn((cb: Listener) => {
  mockNetInfoListeners.push(cb);
  return () => {
    const i = mockNetInfoListeners.indexOf(cb);
    if (i >= 0) mockNetInfoListeners.splice(i, 1);
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { addEventListener: mockNetInfoAddEventListener },
  addEventListener: mockNetInfoAddEventListener,
}));

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
  mockNetInfoListeners.length = 0;
  mockNetInfoAddEventListener.mockClear();
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
  return { sync, getDatabase: database.getDatabase, api: apiMod };
}

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 10));
}

describe("C4: NetInfo reconnect sync trigger", () => {
  it("offline → online fires syncAll and flushes queued rewards", async () => {
    const mods = getModules();
    mods.api.pushRewardsBulk.mockResolvedValue(null);

    const db = await mods.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (1, 'A', '#111', 0, 0, 8, 1)"
    );
    await db.runAsync(
      "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 5, 'queued', 0)"
    );

    const detach = mods.sync.attachNetInfoReconnectTrigger();
    expect(mockNetInfoAddEventListener).toHaveBeenCalledTimes(1);

    // Simulate: first event (already offline — baseline), then reconnect.
    mockNetInfoListeners[0]({ isConnected: false, isInternetReachable: false });
    await flush();
    expect(mods.api.pushRewardsBulk).not.toHaveBeenCalled();

    mockNetInfoListeners[0]({ isConnected: true, isInternetReachable: true });
    await flush();

    expect(mods.api.pushRewardsBulk).toHaveBeenCalledTimes(1);
    expect(mods.api.pushRewardsBulk.mock.calls[0][0]).toBe(1);

    detach();
  });

  it("staying connected does not re-trigger sync on subsequent events", async () => {
    const mods = getModules();
    mods.api.pushRewardsBulk.mockResolvedValue(null);

    const db = await mods.getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (1, 'A', '#111', 0, 0, 8, 1)"
    );
    await db.runAsync(
      "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 5, 'queued', 0)"
    );

    mods.sync.attachNetInfoReconnectTrigger();

    // First "online" event — treated as baseline, no sync yet.
    mockNetInfoListeners[0]({ isConnected: true, isInternetReachable: true });
    await flush();
    const callsAfterFirst = mods.api.pushRewardsBulk.mock.calls.length;

    // Still connected — no new trigger.
    mockNetInfoListeners[0]({ isConnected: true, isInternetReachable: true });
    await flush();
    expect(mods.api.pushRewardsBulk.mock.calls.length).toBe(callsAfterFirst);
  });

  it("isConnected=true but isInternetReachable=false does not trigger", async () => {
    const mods = getModules();
    mods.sync.attachNetInfoReconnectTrigger();

    mockNetInfoListeners[0]({ isConnected: false, isInternetReachable: false });
    mockNetInfoListeners[0]({ isConnected: true, isInternetReachable: false });
    await flush();

    expect(mods.api.pushRewardsBulk).not.toHaveBeenCalled();
  });
});
