import { useEffect, useState, useCallback } from "react";
import { getStreakStatus } from "../lib/streak";
import { onDataChange } from "../lib/db-events";
import type { StreakStatus } from "../types";

interface ChildStreaks {
  [childId: number]: StreakStatus;
}

export function useChildStreaks(childIds: number[]) {
  const [streaks, setStreaks] = useState<ChildStreaks>({});

  const load = useCallback(async () => {
    const results: ChildStreaks = {};
    await Promise.all(
      childIds.map(async (id) => {
        results[id] = await getStreakStatus(id);
      })
    );
    setStreaks(results);
  }, [childIds.join(",")]);

  useEffect(() => {
    load();
    return onDataChange("streak", load);
  }, [load]);

  return streaks;
}
