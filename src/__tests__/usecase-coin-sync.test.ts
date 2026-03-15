/**
 * Use case: Koin anak harus konsisten setelah sync
 *
 * Bugs:
 * 1. upsertChildFromServer() overwrite coins lokal dengan server value yang stale
 *    → anak kehilangan koin (20 → 18)
 * 2. Tidak ada pull reward_history → koin dari device lain tidak masuk
 * 3. Kalau koin dikurangi (game purchase), MAX(local, server) naif tidak tepat
 *
 * Fix: coins/stars = SUM(reward_history), bukan denormalized counter.
 * Sync reward_history dua arah, lalu recalculate totals.
 *
 * Flow setelah fix:
 *   1. Push unsynced rewards → server
 *   2. Pull reward_history dari server → merge (skip duplikat via idempotency_key)
 *   3. Recalculate coins = SUM(count) FROM reward_history WHERE type='coin'
 *   4. Update children.coins/stars dari recalculate
 *   5. upsertChildFromServer: update name/avatar/age SAJA
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

  mockApi.isLoggedIn.mockResolvedValue(true);
  mockApi.pushRewardsBulk.mockResolvedValue(null);
  mockApi.pushReadingProgress.mockResolvedValue(null);
  mockApi.pushReadingLog.mockResolvedValue(null);
  mockApi.fetchReadingLog.mockResolvedValue([]);

  mockChildren.getUnsyncedChildren.mockResolvedValue([]);
  mockChildren.linkChildToServer.mockResolvedValue(undefined);
  mockChildren.upsertChildFromServer.mockResolvedValue(undefined);
  mockChildren.deleteChildrenNotIn.mockResolvedValue(undefined);

  mockRewards.getUnsyncedReadingProgress.mockResolvedValue({});
  mockRewards.getUnsyncedRewards.mockResolvedValue([]);
  mockRewards.markRewardsSynced.mockResolvedValue(undefined);
  mockRewards.markReadingProgressSynced.mockResolvedValue(undefined);
  mockRewards.mergeServerRewards.mockResolvedValue(undefined);
  mockRewards.recalculateBalance.mockResolvedValue({ coins: 0, stars: 0 });

  mockDevice.getDeviceId.mockResolvedValue("device-1");
});

describe("Coin sync: coins harus dihitung dari reward_history, bukan server counter", () => {
  it("push 2 rewards → server returns stale coins → lokal harus tetap benar", async () => {
    // Anak punya 2 unsynced rewards (earned offline)
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      { id: 1, type: "coin", count: 1, description: "Baca buku A", created_at: "2026-03-15T10:00:00" },
      { id: 2, type: "coin", count: 1, description: "Baca buku B", created_at: "2026-03-15T10:05:00" },
    ]);

    // Server returns stale coins (18, belum termasuk 2 baru)
    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 8, avatar_color: "#E91E63", coins: 18, stars: 5 },
    ]);

    // After sync, pull server rewards and merge locally
    mockApi.fetchRewardHistory.mockResolvedValue([]);
    mockRewards.recalculateBalance.mockResolvedValue({ coins: 20, stars: 5 });

    const upsertCalls: any[] = [];
    mockChildren.upsertChildFromServer.mockImplementation(async (child) => {
      upsertCalls.push({ ...child });
    });

    await syncAll([1]);

    // Key assertion: upsertChildFromServer should NOT overwrite coins from server
    if (upsertCalls.length > 0) {
      expect(upsertCalls[0].coins).not.toBe(18);
    }

    // recalculateBalance MUST be called to recompute from reward_history
    expect(mockRewards.recalculateBalance).toHaveBeenCalledWith(1);
  });

  it("reward_history di-pull dari server → koin dari device lain masuk", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([]);

    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 8, avatar_color: "#E91E63", coins: 25, stars: 10 },
    ]);

    // Server has rewards from another device
    mockApi.fetchRewardHistory.mockResolvedValue([
      { type: "coin", count: 5, description: "Dari device lain",
        created_at: "2026-03-15T09:00:00", idempotency_key: "device-2:50" },
    ]);

    await syncAll([1]);

    // Pull reward history harus dipanggil
    expect(mockApi.fetchRewardHistory).toHaveBeenCalledWith(1);
    // Merge harus dipanggil dengan server rewards
    expect(mockRewards.mergeServerRewards).toHaveBeenCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ idempotency_key: "device-2:50" }),
    ]));
  });

  it("koin dikurangi (game purchase) → setelah sync tetap berkurang", async () => {
    mockRewards.getUnsyncedRewards.mockResolvedValue([
      // Negative reward = purchase/pengeluaran
      { id: 10, type: "coin", count: -5, description: "Beli game X", created_at: "2026-03-15T11:00:00" },
    ]);

    mockApi.fetchChildren.mockResolvedValue([
      { id: 1, name: "Ahmad", age: 8, avatar_color: "#E91E63", coins: 20, stars: 5 },
    ]);

    mockApi.fetchRewardHistory.mockResolvedValue([]);
    mockRewards.recalculateBalance.mockResolvedValue({ coins: 15, stars: 5 });

    await syncAll([1]);

    // Balance must be recalculated, NOT use MAX(local, server)
    expect(mockRewards.recalculateBalance).toHaveBeenCalledWith(1);
  });
});
