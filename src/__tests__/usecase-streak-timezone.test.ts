/**
 * TIMEZONE BUG TEST: Users in WIB (UTC+7) who read between 00:00-06:59
 * should be recognized as having read "today", not "yesterday".
 *
 * Before fix: today() uses toISOString().substring(0,10) → UTC date → morning readers get false negative.
 * After fix: today() returns local YYYY-MM-DD → morning readers get correct streak.
 */
describe("Streak timezone handling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("today() returns local date, not UTC date", async () => {
    // Set system time to 2026-06-29 04:00:00 in UTC+7 (WIB)
    // In UTC this is 2026-06-28 21:00:00 — toISOString() gives "2026-06-28..."
    // But local date is 2026-06-29
    const mockDate = new Date("2026-06-28T21:00:00.000Z"); // = June 29, 04:00 WIB
    jest.setSystemTime(mockDate);

    // Force timezone to WIB (UTC+7) for this test
    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Jakarta";

    // Load the module fresh so it picks up the mocked Date
    delete require.cache[require.resolve("../lib/streak")];
    const { today } = require("../lib/streak");

    const todayStr = today();
    expect(todayStr).toBe("2026-06-29"); // local WIB date, NOT "2026-06-28" (UTC)

    // Restore timezone
    if (originalTz) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }
  });

  it("yesterday() returns local yesterday, not UTC yesterday", async () => {
    const mockDate = new Date("2026-06-28T21:00:00.000Z"); // = June 29, 04:00 WIB
    jest.setSystemTime(mockDate);

    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Jakarta";

    delete require.cache[require.resolve("../lib/streak")];
    const { yesterday } = require("../lib/streak");

    const yestStr = yesterday();
    expect(yestStr).toBe("2026-06-28"); // local WIB yesterday

    if (originalTz) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }
  });

  it("recognizes morning reading as 'today' not 'yesterday'", async () => {
    const mockDate = new Date("2026-06-28T21:00:00.000Z"); // June 29, 04:00 WIB
    jest.setSystemTime(mockDate);

    const originalTz = process.env.TZ;
    process.env.TZ = "Asia/Jakarta";

    delete require.cache[require.resolve("../lib/streak")];
    const { getStreakStatus } = require("../lib/streak");

    const { __mockDb } = global as any;
    __mockDb.getAllAsync.mockResolvedValueOnce([
      { completed_at: "2026-06-29T04:00:00.000Z" },
    ]);

    const status = await getStreakStatus(1);
    expect(status.currentStreak).toBeGreaterThanOrEqual(1);
    expect(status.graceActive).toBe(false);

    if (originalTz) {
      process.env.TZ = originalTz;
    } else {
      delete process.env.TZ;
    }
  });
});
