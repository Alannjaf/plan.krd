"use client";

import { useQuery } from "@tanstack/react-query";
import { getLists, type List } from "@/lib/actions/lists";

export const queryKeys = {
  lists: (boardId: string) => ["lists", boardId] as const,
};

export function useLists(boardId: string) {
  return useQuery({
    queryKey: queryKeys.lists(boardId),
    queryFn: () => getLists(boardId),
    enabled: !!boardId,
  });
}
