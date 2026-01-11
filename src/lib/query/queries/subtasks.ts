"use client";

import { useQuery } from "@tanstack/react-query";
import { getSubtasks, type Subtask } from "@/lib/actions/subtasks";

export const queryKeys = {
  subtasks: (taskId: string) => ["subtasks", taskId] as const,
};

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: queryKeys.subtasks(taskId),
    queryFn: () => getSubtasks(taskId),
    enabled: !!taskId,
  });
}
