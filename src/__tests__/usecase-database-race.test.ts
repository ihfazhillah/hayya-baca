/**
 * Use case: App startup — semua module akses database bersamaan, tidak boleh crash
 *
 * Bug yang berulang: "NativeDatabase prepare async has been rejected"
 * Penyebab: Multiple concurrent getDatabase() → openDatabaseAsync dipanggil berkali-kali
 *
 * Test ini exercise actual app startup flow:
 *   syncAll() + syncContent() + fetchAllArticles() + loadChildren()
 *   semua dipanggil bersamaan di _layout.tsx useEffect
 *
 * Expectation: openDatabaseAsync hanya dipanggil SEKALI
 */

let mockOpenCallCount = 0;

const mockDbInstance = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn().mockImplementation(() => {
    mockOpenCallCount++;
    return new Promise((resolve) => setTimeout(() => resolve(mockDbInstance), 20));
  }),
}));

// Mock network calls — we're testing database, not network
jest.mock("../lib/api", () => ({
  isLoggedIn: jest.fn().mockResolvedValue(false),
  fetchChildren: jest.fn().mockResolvedValue([]),
  fetchArticleList: jest.fn().mockRejectedValue(new Error("offline")),
  fetchArticleDetail: jest.fn().mockRejectedValue(new Error("offline")),
}));

jest.mock("../lib/device", () => ({
  getDeviceId: jest.fn().mockResolvedValue("test-device"),
  getDeviceName: jest.fn().mockReturnValue("Test"),
}));

// Mock content-manager network calls only
const mockOriginalFetch = global.fetch;
beforeEach(() => {
  mockOpenCallCount = 0;
  // Block manifest fetch (network)
  global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as any;
});
afterEach(() => {
  global.fetch = mockOriginalFetch;
});

describe("App startup: concurrent database access from multiple modules", () => {
  it("syncAll + syncContent + fetchAllArticles bersamaan → openDatabaseAsync hanya 1x", async () => {
    // Reset module state so each test gets fresh singletons
    jest.resetModules();

    // Re-require after resetModules
    const { syncAll } = require("../lib/sync");
    const { syncContent } = require("../lib/content-manager");
    const { fetchAllArticles } = require("../lib/articles");
    const { getAllReadingProgress } = require("../lib/rewards");

    // Simulate actual _layout.tsx useEffect — all fire at once
    await Promise.allSettled([
      syncAll(),
      syncContent(),
      fetchAllArticles(),
      getAllReadingProgress(1),
    ]);

    // Critical assertion: database only opened ONCE despite 4 concurrent modules
    expect(mockOpenCallCount).toBe(1);
  });

  it("berulang kali foreground (simulate AppState change) → tetap 1 database connection", async () => {
    jest.resetModules();

    const { syncAll } = require("../lib/sync");
    const { fetchAllArticles } = require("../lib/articles");

    // First foreground
    await Promise.allSettled([syncAll(), fetchAllArticles()]);
    expect(mockOpenCallCount).toBe(1);

    // Second foreground (user switches app back)
    await Promise.allSettled([syncAll(), fetchAllArticles()]);
    expect(mockOpenCallCount).toBe(1); // still 1, not 2

    // Third foreground
    await Promise.allSettled([syncAll(), fetchAllArticles()]);
    expect(mockOpenCallCount).toBe(1);
  });
});
