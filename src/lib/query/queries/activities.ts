"use client";

import { useQuery } from "@tanstack/react-query";
import { getTaskActivities, type TaskActivity } from "@/lib/actions/activities";

export const queryKeys = {
  taskActivities: (taskId: string) => ["activities", taskId] as const,
};

export function useTaskActivities(taskId: string) {
  return useQuery({
    queryKey: queryKeys.taskActivities(taskId),
    queryFn: () => getTaskActivities(taskId),
    enabled: !!taskId,
  });
}
