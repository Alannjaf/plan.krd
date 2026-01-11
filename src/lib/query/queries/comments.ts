"use client";

import { useQuery } from "@tanstack/react-query";
import { getComments, type Comment } from "@/lib/actions/comments";

export const queryKeys = {
  comments: (taskId: string) => ["comments", taskId] as const,
};

export function useComments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.comments(taskId),
    queryFn: () => getComments(taskId),
    enabled: !!taskId,
  });
}
