import { useEffect, useState } from "react";
import { getDatabase } from "./database";
import { onDataChange } from "./db-events";

export function useUnsyncedCount(childId: number | null | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (childId == null) {
      setCount(0);
      return;
    }
    let cancelled = false;

    async function refresh() {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<{ cnt: number }>(
          `SELECT
             (SELECT COUNT(*) FROM reward_history WHERE child_id = ? AND synced = 0) +
             (SELECT COUNT(*) FROM reading_progress WHERE child_id = ? AND synced = 0) +
             (SELECT COUNT(*) FROM reading_log WHERE child_id = ? AND synced = 0) as cnt`,
          childId, childId, childId
        );
        if (!cancelled) setCount(row?.cnt ?? 0);
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    refresh();
    const unsubs = [
      onDataChange("rewards", refresh),
      onDataChange("children", refresh),
    ];
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [childId]);

  return count;
}
