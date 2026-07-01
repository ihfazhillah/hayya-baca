/**
 * Use case: Device baru load streak dari server
 *
 * 1. Device baru (lokal kosong) + server punya streak → pakai server values
 * 2. Device lama (lokal ada data) → merge max(local, server)
 * 3. syncStreaks → simpan server computed values ke settings
 * 4. Grace expired di server → streak reset meski server punya value
 */
import * as streak from "../lib/streak";
import * as database from "../lib/database";
import * as api from "../lib/api";
import * as sync from "../lib/sync";

jest.mock("../lib/database");
jest.mock("../lib/api");

const mockDb = database as jest.Mocked<typeof database>;
const mockApi = api as jest.Mocked<typeof api>;
const mockStreak = streak as jest.Mocked<typeof streak>;

beforeEach(() => {
  jest.clearAllMocks();

  // Default: empty local DB
  const mockDbInstance = {
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue(undefined),
  };
  mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);
  mockDb.getSetting.mockResolvedValue(null);

  mockApi.pullStreakStatus.mockResolvedValue(null);
});

describe("Device baru: streak dari server", () => {
  it("lokal kosong + server punya streak → pakai server values", async () => {
    // Simulate server streak values stored in settings (from previous sync)
    mockDb.getSetting.mockImplementation(async (key) => {
      if (key === "server_streak_1") {
        return JSON.stringify({
          currentStreak: 10,
          longestStreak: 15,
          lastReadingDate: "2026-06-29",
        });
      }
      if (key === "grace_1") {
        return JSON.stringify({
          graceActive: true,
          gracePeriodEndDate: "2026-07-02",
          graceDaysRemaining: 1,
        });
      }
      if (key === "badge_1") {
        return "tunas_hijau";
      }
      return null;
    });

    // Local DB returns empty (new device)
    const mockDbInstance = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);

    const status = await streak.getStreakStatus(1);

    expect(status.currentStreak).toBe(10);
    expect(status.longestStreak).toBe(15);
    expect(status.lastReadingDate).toBe("2026-06-29");
    expect(status.graceActive).toBe(true);
    expect(status.badgeLevel).toBe("sprout");
  });

  it("lokal kosong + server streak 0 → return zeros", async () => {
    mockDb.getSetting.mockImplementation(async (key) => {
      if (key === "server_streak_1") {
        return JSON.stringify({
          currentStreak: 0,
          longestStreak: 0,
          lastReadingDate: null,
        });
      }
      return null;
    });

    const mockDbInstance = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);

    const status = await streak.getStreakStatus(1);

    expect(status.currentStreak).toBe(0);
    expect(status.longestStreak).toBe(0);
    expect(status.lastReadingDate).toBe(null);
  });

  it("lokal kosong + tanpa server data → return zeros", async () => {
    // No server streak values stored
    mockDb.getSetting.mockResolvedValue(null);

    const mockDbInstance = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);

    const status = await streak.getStreakStatus(1);

    expect(status.currentStreak).toBe(0);
    expect(status.longestStreak).toBe(0);
    expect(status.badgeLevel).toBe("none");
  });

  it("grace expired → streak reset meski server punya value", async () => {
    mockDb.getSetting.mockImplementation(async (key) => {
      if (key === "server_streak_1") {
        return JSON.stringify({
          currentStreak: 10,
          longestStreak: 15,
          lastReadingDate: "2026-06-20",
        });
      }
      if (key === "grace_1") {
        return JSON.stringify({
          graceActive: true,
          gracePeriodEndDate: "2026-06-23",
          graceDaysRemaining: 0,
        });
      }
      return null;
    });

    const mockDbInstance = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);

    const status = await streak.getStreakStatus(1);

    expect(status.currentStreak).toBe(0);
    expect(status.longestStreak).toBe(15); // longest persists
  });
});

describe("Device lama: merge local + server", () => {
  it("local calc < server base → pakai server base", async () => {
    // Local has only 3 days of logs (partial after fresh install)
    const mockDbInstance = {
      getAllAsync: jest.fn().mockResolvedValue([
        { completed_at: "2026-06-29T10:00:00Z" },
        { completed_at: "2026-06-28T10:00:00Z" },
        { completed_at: "2026-06-27T10:00:00Z" },
      ]),
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);

    mockDb.getSetting.mockImplementation(async (key) => {
      if (key === "server_streak_1") {
        return JSON.stringify({
          currentStreak: 10,
          longestStreak: 15,
          lastReadingDate: "2026-06-29",
        });
      }
      if (key === "badge_1") {
        return "tunas_hijau";
      }
      return null;
    });

    const status = await streak.getStreakStatus(1);

    // Local calc = 3, server = 10 → use max = 10
    expect(status.currentStreak).toBe(10);
    // Local longest = 3, server = 15 → use max = 15
    expect(status.longestStreak).toBe(15);
  });

  it("local calc > server base → pakai local calc", async () => {
    // Local has 15 consecutive days starting from today
    const dates: { completed_at: string }[] = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push({
        completed_at: d.toISOString(),
      });
    }

    const mockDbInstance = {
      getAllAsync: jest.fn().mockResolvedValue(dates),
      getFirstAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockDb.getDatabase.mockResolvedValue(mockDbInstance as any);

    mockDb.getSetting.mockImplementation(async (key) => {
      if (key === "server_streak_1") {
        return JSON.stringify({
          currentStreak: 5, // server lagging
          longestStreak: 10,
          lastReadingDate: streak.yesterday(),
        });
      }
      return null;
    });

    const status = await streak.getStreakStatus(1);

    expect(status.currentStreak).toBeGreaterThanOrEqual(15);
    expect(status.longestStreak).toBeGreaterThanOrEqual(15);
  });
});

describe("setServerStreakValues dan getServerStreakValues", () => {
  it("simpan lalu baca server streak values", async () => {
    await streak.setServerStreakValues(1, 10, 15, "2026-06-29");

    expect(mockDb.setSetting).toHaveBeenCalledWith(
      "server_streak_1",
      JSON.stringify({ currentStreak: 10, longestStreak: 15, lastReadingDate: "2026-06-29" })
    );

    mockDb.getSetting.mockResolvedValue(
      JSON.stringify({ currentStreak: 10, longestStreak: 15, lastReadingDate: "2026-06-29" })
    );

    const values = await streak.getServerStreakValues(1);
    expect(values).toEqual({
      currentStreak: 10,
      longestStreak: 15,
      lastReadingDate: "2026-06-29",
    });
  });
});
