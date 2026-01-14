"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { getTasksWithRelations, getTask, type TaskWithRelations, type PaginationParams } from "@/lib/actions/tasks";

export const queryKeys = {
  tasksByBoard: (boardId?: string) => ["tasks", "board", boardId] as const,
  tasksByBoardInfinite: (boardId?: string) => ["tasks", "board", "infinite", boardId] as const,
  task: (taskId: string) => ["tasks", taskId] as const,
};

const TASKS_PER_PAGE = 50;

export function useTasksWithRelations(
  boardId: string,
  includeArchived = false,
  initialData?: TaskWithRelations[]
) {
  return useQuery({
    queryKey: queryKeys.tasksByBoard(boardId),
    queryFn: async () => {
      const result = await getTasksWithRelations(boardId, includeArchived);
      // Handle both array and paginated result for backward compatibility
      return Array.isArray(result) ? result : result.tasks;
    },
    enabled: !!boardId,
    initialData: initialData,
    refetchOnMount: initialData ? false : true, // Don't refetch if we have initial data
  });
}

/**
 * Infinite query hook for paginated tasks
 * Use this for large boards with many tasks
 */
export function useTasksWithRelationsInfinite(
  boardId: string,
  includeArchived = false
) {
  return useInfiniteQuery({
    queryKey: queryKeys.tasksByBoardInfinite(boardId),
    queryFn: async ({ pageParam = 0 }) => {
      const pagination: PaginationParams = {
        limit: TASKS_PER_PAGE,
        offset: pageParam * TASKS_PER_PAGE,
      };
      const result = await getTasksWithRelations(boardId, includeArchived, pagination);
      // Result is always paginated when pagination params are provided
      return result as { tasks: TaskWithRelations[]; total: number; hasMore: boolean };
    },
    enabled: !!boardId,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length;
    },
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
