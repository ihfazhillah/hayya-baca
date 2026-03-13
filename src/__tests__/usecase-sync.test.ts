/**
 * Use case: App sinkronisasi data dengan server
 *
 * 1. Tidak ada token → sync di-skip, app tetap jalan offline
 * 2. Ada token → sync children dari server → upsert lokal
 * 3. Push reading progress ke server
 * 4. Push unsynced rewards ke server → mark synced
 * 5. Sync gagal → tidak block app, cuma console.warn
 * 6. Concurrent sync dicegah (lock)
 * 7. Push local children ke server sebelum pull
 */
import { syncAll } from "../lib/sync";
import * as api from "../lib/api";
import * as children from "../lib/children";
import * as rewards from "../lib/rewards";

jest.mock("../lib/api");
jest.mock("../lib/children");
jest.mock("../lib/rewards");

const mockApi = api as jest.Mocked<typeof api>;
const mockChildren = children as jest.Mocked<typeof children>;
const mockRewards = rewards as jest.Mocked<typeof rewards>;

beforeEach(() => {
  jest.clearAllMocks();

  // Defaults
  mockApi.isLoggedIn.mockResolvedValue(false);
  mockApi.fetchChildren.mockResolvedValue([]);
  mockApi.pushReadingProgress.mockResolvedValue(undefined);
  mockApi.pushRewardsBulk.mockResolvedValue(undefined);

  mockChildren.upsertChildFromServer.mockResolvedValue(undefined);
  mockChildren.deleteChildrenNotIn.mockResolvedValue(undefined);
  mockChildren.getUnsyncedChildren.mockResolvedValue([]);
  mockChildren.linkChildToServer.mockResolvedValue(undefined);
  mockApi.createChildOnServer.mockResolvedValue({ id: 100, name: "", age: null, avatar_color: "", coins: 0, stars: 0 });

  mockRewards.getAllReadingProgress.mockResolvedValue({});
  mockRewards.getUnsyncedRewards.mockResolvedValue([]);
  mockRewards.markRewardsSynced.mockResolvedValue(undefined);
});

describe("Sync: offline mode (tidak ada token)", () => {
  it("skip sync, tidak panggil API apapun", async () => {
    mockApi.isLoggedIn.mockResolvedValue(false);

    await syncAll();

    expect(mockApi.fetchChildren).not.toHaveBeenCalled();
    expect(mockApi.pushReadingProgress).not.toHaveBeenCalled();
    expect(mockApi.pushRewardsBulk).not.toHaveBeenCalled();
  });
});

describe("Sync: children dari server", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
  });

  it("fetch children → upsert ke lokal", async () => {
    const serverKids = [
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 15, stars: 8 },
      { id: 2, name: "Fatimah", age: 7, avatar_color: "#9C27B0", coins: 10, stars: 4 },
    ];
    mockApi.fetchChildren.mockResolvedValue(serverKids);

    await syncAll();

    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledTimes(2);
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledWith(serverKids[0]);
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledWith(serverKids[1]);
  });

  it("hapus anak lokal yang tidak ada di server", async () => {
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 15, stars: 8 },
    ]);

    await syncAll();

    expect(mockChildren.deleteChildrenNotIn).toHaveBeenCalledWith([1]);
  });
});

describe("Sync: push reading progress", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]);
  });

  it("push setiap buku yang ada progressnya", async () => {
    mockRewards.getAllReadingProgress.mockResolvedValue({
      "1": { lastPage: 5, completed: true, completedCount: 1 },
      "3": { lastPage: 2, completed: false, completedCount: 0 },
    });

    await syncAll();

    expect(mockApi.pushReadingProgress).toHaveBeenCalledTimes(2);
    expect(mockApi.pushReadingProgress).toHaveBeenCalledWith(1, {
      book: "1",
      last_page: 5,
      completed: true,
      completed_count: 1,
    });
    expect(mockApi.pushReadingProgress).toHaveBeenCalledWith(1, {
      book: "3",
      last_page: 2,
      completed: false,
      completed_count: 0,
    });
  });

  it("tidak ada progress → tidak push", async () => {
    mockRewards.getAllReadingProgress.mockResolvedValue({});

    await syncAll();

    expect(mockApi.pushReadingProgress).not.toHaveBeenCalled();
  });
});

describe("Sync: push rewards", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]);
  });

  it("push unsynced rewards → mark synced", async () => {
    const unsynced = [
      { id: 10, type: "coin", count: 3, description: "Baca buku", created_at: "2026-03-13T10:00:00" },
      { id: 11, type: "star", count: 4, description: "Halaman 1", created_at: "2026-03-13T10:01:00" },
    ];
    mockRewards.getUnsyncedRewards.mockResolvedValue(unsynced);

    await syncAll();

    expect(mockApi.pushRewardsBulk).toHaveBeenCalledWith(1, [
      { type: "coin", count: 3, description: "Baca buku", created_at: "2026-03-13T10:00:00" },
      { type: "star", count: 4, description: "Halaman 1", created_at: "2026-03-13T10:01:00" },
    ]);
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledWith([10, 11]);
  });

  it("tidak ada unsynced rewards → skip push", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([]);

    await syncAll();

    expect(mockApi.pushRewardsBulk).not.toHaveBeenCalled();
    expect(mockRewards.markRewardsSynced).not.toHaveBeenCalled();
  });
});

describe("Sync: error handling", () => {
  it("network error → tidak crash, silently warn", async () => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockRejectedValue(new Error("Network error"));

    // Should not throw
    await expect(syncAll()).resolves.toBeUndefined();
  });

  it("push error per child → tetap lanjut anak berikutnya", async () => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
      { id: 2, name: "Fatimah", age: 7, avatar_color: "#9C27B0", coins: 0, stars: 0 },
    ]);
    mockRewards.getAllReadingProgress
      .mockRejectedValueOnce(new Error("DB error")) // child 1 fails
      .mockResolvedValueOnce({}); // child 2 succeeds

    await syncAll();

    // Should still attempt child 2
    expect(mockRewards.getAllReadingProgress).toHaveBeenCalledTimes(2);
  });
});

describe("Sync: concurrent lock", () => {
  it("concurrent syncAll calls → hanya yang pertama jalan", async () => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50))
    );

    // Start two syncs simultaneously
    const p1 = syncAll();
    const p2 = syncAll();

    await Promise.all([p1, p2]);

    // fetchChildren should only be called once (second sync skipped)
    expect(mockApi.fetchChildren).toHaveBeenCalledTimes(1);
  });
});

describe("Sync: push local children to server", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
  });

  it("unsynced children → push ke server → linkChildToServer dipanggil", async () => {
    mockChildren.getUnsyncedChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63" },
      { id: 2, name: "Fatimah", age: 7, avatar_color: "#9C27B0" },
    ]);
    mockApi.fetchChildren.mockResolvedValue([]); // no server children yet
    mockApi.createChildOnServer
      .mockResolvedValueOnce({ id: 101, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 })
      .mockResolvedValueOnce({ id: 102, name: "Fatimah", age: 7, avatar_color: "#9C27B0", coins: 0, stars: 0 });

    await syncAll();

    expect(mockApi.createChildOnServer).toHaveBeenCalledTimes(2);
    expect(mockChildren.linkChildToServer).toHaveBeenCalledWith(1, 101);
    expect(mockChildren.linkChildToServer).toHaveBeenCalledWith(2, 102);
  });

  it("no unsynced children → skip push, tetap pull", async () => {
    mockChildren.getUnsyncedChildren.mockResolvedValue([]);
    const serverKids = [
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 15, stars: 8 },
    ];
    mockApi.fetchChildren.mockResolvedValue(serverKids);

    await syncAll();

    expect(mockApi.createChildOnServer).not.toHaveBeenCalled();
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledWith(serverKids[0]);
  });

  it("push gagal 1 anak → lanjut anak lain + pull tetap jalan", async () => {
    mockChildren.getUnsyncedChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63" },
      { id: 2, name: "Fatimah", age: 7, avatar_color: "#9C27B0" },
    ]);
    mockApi.fetchChildren.mockResolvedValue([]);
    mockApi.createChildOnServer
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ id: 102, name: "Fatimah", age: 7, avatar_color: "#9C27B0", coins: 0, stars: 0 });

    await syncAll();

    // First child failed, second succeeded
    expect(mockChildren.linkChildToServer).toHaveBeenCalledTimes(1);
    expect(mockChildren.linkChildToServer).toHaveBeenCalledWith(2, 102);
    // Pull still happened (fetchChildren called for initial + re-fetch)
    expect(mockApi.fetchChildren).toHaveBeenCalled();
  });

  it("anak online (id cocok server) → set server_id tanpa push ulang", async () => {
    mockChildren.getUnsyncedChildren.mockResolvedValue([
      { id: 101, name: "Ahmad", age: 5, avatar_color: "#E91E63" },
    ]);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 101, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 15, stars: 8 },
    ]);

    await syncAll();

    // Should link without creating on server
    expect(mockApi.createChildOnServer).not.toHaveBeenCalled();
    expect(mockChildren.linkChildToServer).toHaveBeenCalledWith(101, 101);
  });
});
