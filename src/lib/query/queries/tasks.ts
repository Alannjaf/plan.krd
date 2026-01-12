"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksWithRelations, getTask, type TaskWithRelations } from "@/lib/actions/tasks";

export const queryKeys = {
  tasksByBoard: (boardId?: string) => ["tasks", "board", boardId] as const,
  task: (taskId: string) => ["tasks", taskId] as const,
};

export function useTasksWithRelations(
  boardId: string,
  includeArchived = false,
  initialData?: TaskWithRelations[]
) {
  return useQuery({
    queryKey: queryKeys.tasksByBoard(boardId),
    queryFn: () => getTasksWithRelations(boardId, includeArchived),
    enabled: !!boardId,
    initialData: initialData,
    refetchOnMount: initialData ? false : true, // Don't refetch if we have initial data
  });
}

export function useTask(taskId: string | null, boardId?: string) {
  return useQuery({
    queryKey: queryKeys.task(taskId || ""),
    queryFn: () => {
      if (!taskId) return null;
      return getTask(taskId, boardId);
    },
    enabled: !!taskId,
    staleTime: 30 * 1000, // 30 seconds - task data is fresh, prevents immediate refetch
  });
}

/**
 * Pre-seed individual task cache entries from board data.
 * This allows useTask(taskId) to find cached data instantly
 * instead of making a new request.
 */
export function useSeedTaskCache(tasks: TaskWithRelations[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    tasks.forEach((task) => {
      // Only set if not already in cache to avoid unnecessary updates
      const existing = queryClient.getQueryData(queryKeys.task(task.id));
      if (!existing) {
        queryClient.setQueryData(queryKeys.task(task.id), task);
      }
    });
  }, [tasks, queryClient]);
}
