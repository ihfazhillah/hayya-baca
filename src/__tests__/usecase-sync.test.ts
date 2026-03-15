/**
 * Use case: App sinkronisasi data dengan server
 *
 * 1. Tidak ada token → sync di-skip, app tetap jalan offline
 * 2. Ada token → sync children dari server → upsert lokal
 * 3. Push reading progress ke server (hanya unsynced, hanya active child)
 * 4. Push unsynced rewards ke server → mark synced (hanya active child)
 * 5. Sync gagal → tidak block app, report error
 * 6. Concurrent sync dicegah (lock)
 * 7. Push local children ke server sebelum pull
 * 8. Push-first: rewards/progress dipush SEBELUM pull children (fix overwrite)
 * 9. Active child only: hanya sync data anak yang diminta
 * 10. Idempotency key: setiap reward punya key unik untuk cegah duplikasi
 */
import { syncAll } from "../lib/sync";
import * as api from "../lib/api";
import * as children from "../lib/children";
import * as rewards from "../lib/rewards";
import * as device from "../lib/device";

jest.mock("../lib/api");
jest.mock("../lib/children");
jest.mock("../lib/rewards");
jest.mock("../lib/device");

const mockApi = api as jest.Mocked<typeof api>;
const mockChildren = children as jest.Mocked<typeof children>;
const mockRewards = rewards as jest.Mocked<typeof rewards>;
const mockDevice = device as jest.Mocked<typeof device>;

beforeEach(() => {
  jest.clearAllMocks();

  // Defaults
  mockApi.isLoggedIn.mockResolvedValue(false);
  mockApi.fetchChildren.mockResolvedValue([]);
  mockApi.pushReadingProgress.mockResolvedValue(null);
  mockApi.pushRewardsBulk.mockResolvedValue(null);
  mockApi.pushReadingLog.mockResolvedValue(null);
  mockApi.fetchRewardHistory.mockResolvedValue([]);
  mockApi.fetchReadingLog.mockResolvedValue([]);

  mockChildren.upsertChildFromServer.mockResolvedValue(undefined);
  mockChildren.deleteChildrenNotIn.mockResolvedValue(undefined);
  mockChildren.getUnsyncedChildren.mockResolvedValue([]);
  mockChildren.linkChildToServer.mockResolvedValue(undefined);
  mockApi.createChildOnServer.mockResolvedValue({ id: 100, name: "", age: null, avatar_color: "", coins: 0, stars: 0 });

  mockRewards.getUnsyncedReadingProgress.mockResolvedValue({});
  mockRewards.getUnsyncedRewards.mockResolvedValue([]);
  mockRewards.markRewardsSynced.mockResolvedValue(undefined);
  mockRewards.markReadingProgressSynced.mockResolvedValue(undefined);
  mockRewards.mergeServerRewards.mockResolvedValue(undefined);
  mockRewards.recalculateBalance.mockResolvedValue({ coins: 0, stars: 0 });

  mockDevice.getDeviceId.mockResolvedValue("device-uuid-123");
});

describe("Sync: offline mode (tidak ada token)", () => {
  it("skip sync, tidak panggil API apapun", async () => {
    mockApi.isLoggedIn.mockResolvedValue(false);

    const report = await syncAll();

    expect(report.notLoggedIn).toBe(true);
    expect(mockApi.fetchChildren).not.toHaveBeenCalled();
    expect(mockApi.pushReadingProgress).not.toHaveBeenCalled();
    expect(mockApi.pushRewardsBulk).not.toHaveBeenCalled();
  });
});

describe("Sync: children dari server", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
  });

  it("fetch children → upsert ke lokal (tanpa overwrite coins/stars)", async () => {
    const serverKids = [
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 15, stars: 8 },
      { id: 2, name: "Fatimah", age: 7, avatar_color: "#9C27B0", coins: 10, stars: 4 },
    ];
    mockApi.fetchChildren.mockResolvedValue(serverKids);

    await syncAll();

    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledTimes(2);
    // coins/stars should be undefined — recalculated from reward_history, not server
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Ahmad", coins: undefined, stars: undefined })
    );
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: "Fatimah", coins: undefined, stars: undefined })
    );
  });

  it("hapus anak lokal yang tidak ada di server", async () => {
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 15, stars: 8 },
    ]);

    await syncAll();

    expect(mockChildren.deleteChildrenNotIn).toHaveBeenCalledWith([1]);
  });
});

describe("Sync: active child only", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
      { id: 2, name: "Fatimah", age: 7, avatar_color: "#9C27B0", coins: 0, stars: 0 },
    ]);
  });

  it("syncAll([1]) → hanya push data child 1, bukan child 2", async () => {
    mockRewards.getUnsyncedReadingProgress.mockResolvedValue({
      "1": { lastPage: 5, completed: true, completedCount: 1 },
    });
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 10, type: "coin", count: 3, description: "Baca buku", created_at: "2026-03-13T10:00:00" },
    ]);

    await syncAll([1]);

    // Push hanya untuk child 1
    expect(mockRewards.getUnsyncedReadingProgress).toHaveBeenCalledWith(1);
    expect(mockRewards.getUnsyncedRewards).toHaveBeenCalledWith(1);

    // TIDAK push untuk child 2
    expect(mockRewards.getUnsyncedReadingProgress).not.toHaveBeenCalledWith(2);
    expect(mockRewards.getUnsyncedRewards).not.toHaveBeenCalledWith(2);
  });

  it("syncAll() tanpa childIds → skip push data, tetap pull children", async () => {
    await syncAll();

    // Tetap pull children list
    expect(mockApi.fetchChildren).toHaveBeenCalled();
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledTimes(2);

    // Tidak push data siapapun
    expect(mockRewards.getUnsyncedReadingProgress).not.toHaveBeenCalled();
    expect(mockRewards.getUnsyncedRewards).not.toHaveBeenCalled();
    expect(mockApi.pushReadingProgress).not.toHaveBeenCalled();
    expect(mockApi.pushRewardsBulk).not.toHaveBeenCalled();
  });
});

describe("Sync: push reading progress (unsynced only)", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]);
  });

  it("push hanya unsynced progress → mark synced", async () => {
    mockRewards.getUnsyncedReadingProgress.mockResolvedValue({
      "1": { lastPage: 5, completed: true, completedCount: 1 },
      "3": { lastPage: 2, completed: false, completedCount: 0 },
    });

    await syncAll([1]);

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
    expect(mockRewards.markReadingProgressSynced).toHaveBeenCalledWith(1, expect.arrayContaining(["1", "3"]));
  });

  it("tidak ada unsynced progress → tidak push, tidak mark", async () => {
    mockRewards.getUnsyncedReadingProgress.mockResolvedValue({});

    await syncAll([1]);

    expect(mockApi.pushReadingProgress).not.toHaveBeenCalled();
    expect(mockRewards.markReadingProgressSynced).not.toHaveBeenCalled();
  });
});

describe("Sync: push rewards dengan idempotency key", () => {
  beforeEach(() => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]);
  });

  it("push unsynced rewards dengan idempotency_key → mark synced", async () => {
    const unsynced = [
      { id: 10, type: "coin", count: 3, description: "Baca buku", created_at: "2026-03-13T10:00:00" },
      { id: 11, type: "star", count: 4, description: "Halaman 1", created_at: "2026-03-13T10:01:00" },
    ];
    mockRewards.getUnsyncedRewards.mockResolvedValue(unsynced);

    await syncAll([1]);

    expect(mockApi.pushRewardsBulk).toHaveBeenCalledWith(1, [
      { type: "coin", count: 3, description: "Baca buku", created_at: "2026-03-13T10:00:00", idempotency_key: "device-uuid-123:10" },
      { type: "star", count: 4, description: "Halaman 1", created_at: "2026-03-13T10:01:00", idempotency_key: "device-uuid-123:11" },
    ]);
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledWith([10, 11]);
  });

  it("tidak ada unsynced rewards → skip push", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([]);

    await syncAll([1]);

    expect(mockApi.pushRewardsBulk).not.toHaveBeenCalled();
    expect(mockRewards.markRewardsSynced).not.toHaveBeenCalled();
  });
});

describe("Sync: push-first order (rewards sebelum pull children)", () => {
  it("pushRewardsBulk dipanggil SEBELUM upsertChildFromServer", async () => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]);
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 10, type: "coin", count: 3, description: "Baca buku", created_at: "2026-03-13T10:00:00" },
    ]);

    await syncAll([1]);

    // Verify call order: push rewards before upsert children
    const pushOrder = mockApi.pushRewardsBulk.mock.invocationCallOrder[0];
    const upsertOrder = mockChildren.upsertChildFromServer.mock.invocationCallOrder[0];
    expect(pushOrder).toBeLessThan(upsertOrder);
  });
});

describe("Sync: error handling", () => {
  it("network error → tidak crash, report ada error", async () => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockRejectedValue(new Error("Network error"));

    // Should not throw
    const report = await syncAll();
    expect(report.success).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("push error active child → tidak crash, pull tetap jalan", async () => {
    mockApi.isLoggedIn.mockResolvedValue(true);
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 5, avatar_color: "#E91E63", coins: 0, stars: 0 },
    ]);
    mockRewards.getUnsyncedRewards.mockRejectedValue(new Error("DB error"));

    await syncAll([1]);

    // Pull children tetap jalan meskipun push gagal
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalled();
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
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Ahmad" })
    );
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
    // Pull still happened
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
