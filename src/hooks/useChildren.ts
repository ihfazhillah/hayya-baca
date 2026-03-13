import { useState, useEffect, useCallback } from "react";
import { getChildren, addChild } from "../lib/children";
import { onDataChange } from "../lib/db-events";
import type { Child } from "../types";

export function useChildren() {
  const [data, setData] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const children = await getChildren();
    setData(children);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    return onDataChange("children", load);
  }, [load]);

  return { data, isLoading };
}

export function useAddChild() {
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async ({ name, age }: { name: string; age?: number }) => {
      setIsPending(true);
      try {
        return await addChild(name, age);
      } finally {
        setIsPending(false);
      }
      // No invalidation needed — addChild() emits "children"
    },
    []
  );

  return { mutateAsync, isPending };
}
