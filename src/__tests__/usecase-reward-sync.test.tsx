/**
 * Use case: Data berubah di SQLite → UI auto-refresh via event emitter
 *
 * 1. emitDataChange → semua listener dipanggil
 * 2. onDataChange → return unsubscribe function
 * 3. addReward → emitDataChange("children") dipanggil
 * 4. saveReadingProgress → emitDataChange("children") dipanggil
 * 5. addChild → emitDataChange("children") dipanggil
 * 6. syncAll → upsertChildFromServer emit "children" (via children.ts)
 */
import { onDataChange, emitDataChange } from "../lib/db-events";

describe("db-events: event emitter", () => {
  it("emit triggers all listeners for that table", () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    const unsub1 = onDataChange("children", fn1);
    const unsub2 = onDataChange("children", fn2);

    emitDataChange("children");

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });

  it("emit does not trigger listeners for other tables", () => {
    const childrenFn = jest.fn();
    const otherFn = jest.fn();
    const unsub1 = onDataChange("children", childrenFn);
    const unsub2 = onDataChange("other", otherFn);

    emitDataChange("children");

    expect(childrenFn).toHaveBeenCalledTimes(1);
    expect(otherFn).not.toHaveBeenCalled();

    unsub1();
    unsub2();
  });

  it("unsubscribe stops receiving events", () => {
    const fn = jest.fn();
    const unsub = onDataChange("children", fn);

    emitDataChange("children");
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    emitDataChange("children");
    expect(fn).toHaveBeenCalledTimes(1); // still 1, not 2
  });

  it("emit on table with no listeners does not throw", () => {
    expect(() => emitDataChange("nonexistent")).not.toThrow();
  });
});

describe("addReward emits children change", () => {
  it("addReward calls emitDataChange", async () => {
    const fn = jest.fn();
    const unsub = onDataChange("children", fn);

    const { addReward } = require("../lib/rewards");
    await addReward(1, "coin", 3, "Test reward");

    expect(fn).toHaveBeenCalled();
    unsub();
  });
});

describe("saveReadingProgress emits children change", () => {
  it("saveReadingProgress calls emitDataChange", async () => {
    const fn = jest.fn();
    const unsub = onDataChange("children", fn);

    const { saveReadingProgress } = require("../lib/rewards");
    await saveReadingProgress(1, "5", 9, true);

    expect(fn).toHaveBeenCalled();
    unsub();
  });
});
