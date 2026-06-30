import { useState, useEffect, useCallback } from "react";
import { getStreakStatus } from "../lib/streak";
import { onDataChange } from "../lib/db-events";
import { getSelectedChild } from "../lib/session";
import type { StreakStatus } from "../types";

export function useStreak() {
  const [data, setData] = useState<StreakStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const child = getSelectedChild();
    if (!child) {
      setData(null);
      setIsLoading(false);
      return;
    }
    const status = await getStreakStatus(child.id);
    setData(status);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    return onDataChange("streak", load);
  }, [load]);

  return { data, isLoading };
}
