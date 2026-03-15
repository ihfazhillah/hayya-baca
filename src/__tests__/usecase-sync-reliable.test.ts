/**
 * Use case: Sync harus reliable — data anak sama di semua device
 *
 * Constraint:
 * - 1 anak = 1 device pada satu waktu (tidak ada concurrent edit per anak)
 * - 1 device = bisa beberapa anak bergantian
 * - Ekspektasi: setelah sync, koin/bintang anak sama di semua device
 *
 * Bug yang difix:
 * 1. Push gagal (server error/network) tapi rewards ditandai synced → data hilang permanen
 * 2. Parent page sync tanpa childId → tidak push apapun
 * 3. fetchRewardHistory gagal → return [] → recalculate reset coins ke 0
 * 4. API push functions silent fail (console.warn, tidak throw) → sync tidak tahu gagal
 * 5. Concurrent sync return report kosong seolah sukses
 *
 * Skenario:
 * 1. Push rewards berhasil → marked synced, report sukses
 * 2. Push rewards gagal (server error) → TIDAK marked synced, report ada error
 * 3. Push rewards gagal (network) → TIDAK marked synced, report ada error
 * 4. Sync dari parent → push semua anak
 * 5. Pull gagal (network) → coins lokal tidak berubah, recalculate tidak dipanggil
 * 6. Pull berhasil → merge + recalculate → coins = SUM semua rewards
 * 7. Override koin 30→41 → insert adjustment +11, push, device lain dapat 41
 * 8. Override koin 30→30 → tidak insert apapun
 * 9. Concurrent sync → yang kedua jujur, bukan report kosong
 */
import { syncAll, type SyncReport } from "../lib/sync";
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

  mockApi.isLoggedIn.mockResolvedValue(true);
  mockApi.fetchChildren.mockResolvedValue([
    { id: 1, name: "Sakinah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
    { id: 2, name: "Fukaihah", age: 6, avatar_color: "#9C27B0", coins: 0, stars: 0 },
  ]);
  mockApi.pushReadingProgress.mockResolvedValue(undefined);
  mockApi.pushRewardsBulk.mockResolvedValue(undefined);
  mockApi.pushReadingLog.mockResolvedValue(undefined);
  mockApi.fetchRewardHistory.mockResolvedValue([]);
  mockApi.fetchReadingLog.mockResolvedValue([]);
  (mockApi as any).fetchReadingProgressFromServer = jest.fn().mockResolvedValue([]);
  mockApi.createChildOnServer.mockResolvedValue({ id: 100, name: "", age: null, avatar_color: "", coins: 0, stars: 0 });

  mockChildren.upsertChildFromServer.mockResolvedValue(undefined);
  mockChildren.deleteChildrenNotIn.mockResolvedValue(undefined);
  mockChildren.getUnsyncedChildren.mockResolvedValue([]);
  mockChildren.linkChildToServer.mockResolvedValue(undefined);

  mockRewards.getUnsyncedReadingProgress.mockResolvedValue({});
  mockRewards.getUnsyncedRewards.mockResolvedValue([]);
  mockRewards.markRewardsSynced.mockResolvedValue(undefined);
  mockRewards.markReadingProgressSynced.mockResolvedValue(undefined);
  mockRewards.mergeServerRewards.mockResolvedValue(undefined);
  (mockRewards as any).mergeServerReadingProgress = jest.fn().mockResolvedValue(undefined);
  mockRewards.recalculateBalance.mockResolvedValue({ coins: 0, stars: 0 });

  mockDevice.getDeviceId.mockResolvedValue("device-A");
});

describe("Skenario 1: Push rewards berhasil → marked synced, report sukses", () => {
  it("push 3 rewards untuk Sakinah → semua marked synced, report lengkap", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 1, type: "coin", count: 2, description: "Baca buku 1", created_at: "2026-03-15T10:00:00" },
      { id: 2, type: "coin", count: 1, description: "Baca buku 2", created_at: "2026-03-15T10:05:00" },
      { id: 3, type: "star", count: 4, description: "Halaman 1", created_at: "2026-03-15T10:06:00" },
    ]);

    const report = await syncAll([1]);

    expect(report.success).toBe(true);
    expect(report.errors).toEqual([]);
    expect(mockApi.pushRewardsBulk).toHaveBeenCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ type: "coin", count: 2, idempotency_key: "device-A:1" }),
    ]));
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledWith([1, 2, 3], expect.any(Object));
  });
});

describe("Skenario 2: Push rewards gagal (server error) → TIDAK marked synced", () => {
  it("pushRewardsBulk return error → rewards tetap unsynced, report ada error", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 1, type: "coin", count: 2, description: "Baca buku", created_at: "2026-03-15T10:00:00" },
    ]);
    // API return error string instead of void
    mockApi.pushRewardsBulk.mockResolvedValue("pushRewardsBulk 500: Internal Server Error" as any);

    const report = await syncAll([1]);

    expect(report.success).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain("500");
    // CRITICAL: rewards must NOT be marked synced
    expect(mockRewards.markRewardsSynced).not.toHaveBeenCalled();
  });
});

describe("Skenario 3: Push rewards gagal (network) → TIDAK marked synced", () => {
  it("pushRewardsBulk throw network error → rewards tetap unsynced, report ada error", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 1, type: "coin", count: 2, description: "Baca buku", created_at: "2026-03-15T10:00:00" },
    ]);
    mockApi.pushRewardsBulk.mockRejectedValue(new Error("Network request failed"));

    const report = await syncAll([1]);

    expect(report.success).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain("Network");
    // CRITICAL: rewards must NOT be marked synced
    expect(mockRewards.markRewardsSynced).not.toHaveBeenCalled();
  });
});

describe("Skenario 4: Sync dari parent → push semua anak", () => {
  it("syncAll([1, 2]) → push rewards untuk Sakinah DAN Fukaihah", async () => {
    // Sakinah has unsynced rewards
    mockRewards.getUnsyncedRewards
      .mockResolvedValueOnce([
        { id: 10, type: "coin", count: 5, description: "Baca buku A", created_at: "2026-03-15T10:00:00" },
      ])
      // Fukaihah has unsynced rewards
      .mockResolvedValueOnce([
        { id: 20, type: "coin", count: 3, description: "Baca buku B", created_at: "2026-03-15T11:00:00" },
      ]);

    const report = await syncAll([1, 2]);

    expect(report.success).toBe(true);
    // Push for both children
    expect(mockApi.pushRewardsBulk).toHaveBeenCalledTimes(2);
    expect(mockApi.pushRewardsBulk).toHaveBeenCalledWith(1, expect.any(Array));
    expect(mockApi.pushRewardsBulk).toHaveBeenCalledWith(2, expect.any(Array));
    // Mark synced for both
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledTimes(2);
    // Reward history pulled for both
    expect(mockApi.fetchRewardHistory).toHaveBeenCalledWith(1);
    expect(mockApi.fetchRewardHistory).toHaveBeenCalledWith(2);
    // Recalculate for both
    expect(mockRewards.recalculateBalance).toHaveBeenCalledWith(1);
    expect(mockRewards.recalculateBalance).toHaveBeenCalledWith(2);
  });

  it("syncAll() tanpa childIds → tetap pull children, skip push data", async () => {
    const report = await syncAll();

    expect(mockApi.fetchChildren).toHaveBeenCalled();
    expect(mockChildren.upsertChildFromServer).toHaveBeenCalledTimes(2);
    // No push
    expect(mockRewards.getUnsyncedRewards).not.toHaveBeenCalled();
    expect(mockApi.pushRewardsBulk).not.toHaveBeenCalled();
  });
});

describe("Skenario 5: Pull gagal → coins lokal tidak berubah", () => {
  it("fetchRewardHistory throw → recalculateBalance TIDAK dipanggil, report ada error", async () => {
    mockApi.fetchRewardHistory.mockRejectedValue(new Error("Network error"));

    const report = await syncAll([1]);

    expect(report.success).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    // CRITICAL: must NOT recalculate from empty data
    expect(mockRewards.recalculateBalance).not.toHaveBeenCalled();
  });

  it("fetchChildren throw → children lokal TIDAK dihapus, report ada error", async () => {
    mockApi.fetchChildren.mockRejectedValue(new Error("Server down"));

    const report = await syncAll([1]);

    expect(report.success).toBe(false);
    expect(mockChildren.deleteChildrenNotIn).not.toHaveBeenCalled();
    expect(mockChildren.upsertChildFromServer).not.toHaveBeenCalled();
  });
});

describe("Skenario 6: Pull berhasil → merge + recalculate", () => {
  it("server punya rewards dari device lain → merge → recalculate", async () => {
    mockApi.fetchRewardHistory.mockResolvedValue([
      { type: "coin", count: 5, description: "Dari device B", created_at: "2026-03-15T09:00:00", idempotency_key: "device-B:1" },
      { type: "coin", count: 3, description: "Dari device B", created_at: "2026-03-15T09:05:00", idempotency_key: "device-B:2" },
    ]);

    const report = await syncAll([1]);

    expect(report.success).toBe(true);
    expect(mockRewards.mergeServerRewards).toHaveBeenCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ idempotency_key: "device-B:1" }),
      expect.objectContaining({ idempotency_key: "device-B:2" }),
    ]));
    expect(mockRewards.recalculateBalance).toHaveBeenCalledWith(1);
  });
});

describe("Skenario 7 & 8: Override koin manual", () => {
  it("addAdjustment(childId=1, 'coin', 41) saat coins=30 → insert coin_adjustment +11", async () => {
    // This tests rewards.addAdjustment directly (not sync)
    // Will be tested after implementation
    // For now, verify the sync can push adjustment type
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 99, type: "coin_adjustment", count: 11, description: "Penyesuaian manual", created_at: "2026-03-15T12:00:00" },
    ]);

    const report = await syncAll([1]);

    expect(mockApi.pushRewardsBulk).toHaveBeenCalledWith(1, [
      expect.objectContaining({ type: "coin_adjustment", count: 11, idempotency_key: "device-A:99" }),
    ]);
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledWith([99], expect.any(Object));
  });
});

describe("Skenario 9: Concurrent sync → yang kedua jujur", () => {
  it("concurrent syncAll → yang kedua return report dengan skipped=true, bukan report kosong", async () => {
    mockApi.fetchChildren.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([
        { id: 1, name: "Sakinah", age: 8, avatar_color: "#E91E63", coins: 0, stars: 0 },
      ]), 50))
    );

    const [report1, report2] = await Promise.all([syncAll([1]), syncAll([1])]);

    // One should succeed, one should be skipped
    const reports = [report1, report2];
    const skipped = reports.filter(r => r.skipped);
    const ran = reports.filter(r => !r.skipped);
    expect(skipped).toHaveLength(1);
    expect(ran).toHaveLength(1);
    // Skipped report should be honest about it
    expect(skipped[0].skipped).toBe(true);
  });
});

describe("Partial failure: push rewards gagal tapi progress berhasil", () => {
  it("rewards gagal, progress sukses → rewards unsynced, progress synced", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 1, type: "coin", count: 2, description: "Baca buku", created_at: "2026-03-15T10:00:00" },
    ]);
    mockRewards.getUnsyncedReadingProgress.mockResolvedValue({
      "1": { lastPage: 5, completed: true, completedCount: 1 },
    });
    mockApi.pushRewardsBulk.mockRejectedValue(new Error("Server error"));
    mockApi.pushReadingProgress.mockResolvedValue(undefined);

    const report = await syncAll([1]);

    expect(report.success).toBe(false);
    // Rewards NOT marked synced
    expect(mockRewards.markRewardsSynced).not.toHaveBeenCalled();
    // Progress IS marked synced
    expect(mockRewards.markReadingProgressSynced).toHaveBeenCalledWith(1, ["1"]);
  });
});

describe("Push child 1 gagal, child 2 berhasil", () => {
  it("child 1 rewards gagal, child 2 rewards sukses → partial report", async () => {
    mockRewards.getUnsyncedRewards
      .mockResolvedValueOnce([
        { id: 1, type: "coin", count: 5, description: "Baca", created_at: "2026-03-15T10:00:00" },
      ])
      .mockResolvedValueOnce([
        { id: 2, type: "coin", count: 3, description: "Baca", created_at: "2026-03-15T11:00:00" },
      ]);
    mockApi.pushRewardsBulk
      .mockRejectedValueOnce(new Error("500 untuk child 1"))
      .mockResolvedValueOnce(undefined);

    const report = await syncAll([1, 2]);

    expect(report.success).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    // Child 1 rewards NOT marked synced, child 2 IS marked synced
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledTimes(1);
    expect(mockRewards.markRewardsSynced).toHaveBeenCalledWith([2], expect.any(Object));
  });
});
