import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChildren, addChild } from "../lib/children";

export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: getChildren,
  });
}

export function useAddChild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, age }: { name: string; age?: number }) =>
      addChild(name, age),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
    },
  });
}
