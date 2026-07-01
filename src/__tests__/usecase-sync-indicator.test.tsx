/**
 * Bug #3 — user harus bisa lihat kalau ada data belum tersinkronisasi.
 *
 * useUnsyncedCount(childId) harus return jumlah row synced=0 di semua
 * tabel (reward_history, reading_progress, reading_log) untuk child tsb.
 */

import Database from "better-sqlite3";
import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

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
    getFirstAsync: async function getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
      const stmt = mockTestDb.prepare(sql);
      return (stmt.get(...params) as T) ?? null;
    },
    getAllAsync: async function getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
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

beforeEach(async () => {
  // Wipe rows between tests without resetting modules (keeps React instance stable).
  if (mockTestDb) {
    try {
      mockTestDb.exec("DELETE FROM reward_history; DELETE FROM reading_progress; DELETE FROM reading_log; DELETE FROM children;");
    } catch {}
  }
  jest.clearAllMocks();
});

afterAll(() => {
  if (mockTestDb) { try { mockTestDb.close(); } catch {} }
});

describe("Bug #3: useUnsyncedCount menghitung data pending", () => {
  it("5 reward_history synced=0 → hook return 5", async () => {
    const { useUnsyncedCount } = require("../lib/useUnsyncedCount") as typeof import("../lib/useUnsyncedCount");
    const { getDatabase } = require("../lib/database") as typeof import("../lib/database");

    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    for (let i = 0; i < 5; i++) {
      await db.runAsync(
        "INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (?, 'coin', 1, ?, 0)",
        1, `r${i}`
      );
    }

    function Probe() {
      const n = useUnsyncedCount(1);
      return <Text testID="badge">{n}</Text>;
    }

    const { getByTestId } = render(<Probe />);
    await waitFor(() => {
      expect(getByTestId("badge").props.children).toBe(5);
    });
  });

  it("campuran reward+progress+log → jumlah total", async () => {
    const { useUnsyncedCount } = require("../lib/useUnsyncedCount") as typeof import("../lib/useUnsyncedCount");
    const { getDatabase } = require("../lib/database") as typeof import("../lib/database");

    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO children (id, name, avatar_color, coins, stars, age, server_id) VALUES (?, ?, ?, 0, 0, 8, ?)",
      1, "A", "#111", 1
    );
    await db.runAsync("INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 1, 'x', 0)");
    await db.runAsync("INSERT INTO reward_history (child_id, type, count, description, synced) VALUES (1, 'coin', 1, 'y', 1)"); // already synced
    await db.runAsync(
      `INSERT INTO reading_progress (child_id, book_id, last_page, completed, completed_count, updated_at, synced)
       VALUES (1, '1', 5, 0, 0, '2026-04-01', 0)`
    );
    await db.runAsync(
      "INSERT INTO reading_log (child_id, book_id, completed_at, synced) VALUES (1, '1', '2026-04-01', 0)"
    );

    function Probe() {
      const n = useUnsyncedCount(1);
      return <Text testID="badge">{n}</Text>;
    }

    const { getByTestId } = render(<Probe />);
    await waitFor(() => {
      expect(getByTestId("badge").props.children).toBe(3);
    });
  });

  it("childId null → 0", async () => {
    const { useUnsyncedCount } = require("../lib/useUnsyncedCount") as typeof import("../lib/useUnsyncedCount");

    function Probe() {
      const n = useUnsyncedCount(null);
      return <Text testID="badge">{n}</Text>;
    }

    const { getByTestId } = render(<Probe />);
    expect(getByTestId("badge").props.children).toBe(0);
  });
});
