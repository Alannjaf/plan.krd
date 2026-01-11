"use client";

import { useQuery } from "@tanstack/react-query";
import { getLabels, type Label } from "@/lib/actions/labels";

export const queryKeys = {
  labels: (boardId: string) => ["labels", boardId] as const,
};

export function useLabels(boardId: string) {
  return useQuery({
    queryKey: queryKeys.labels(boardId),
    queryFn: () => getLabels(boardId),
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000, // 5 minutes - labels don't change often
  });
}
