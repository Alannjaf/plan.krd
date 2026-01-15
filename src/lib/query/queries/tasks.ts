"use client";

import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { getTasksWithRelations, getTask, getTasksSummaryByList, getTaskSummary, type TaskWithRelations, type TaskSummary, type PaginationParams, type PaginatedTaskSummaryResult } from "@/lib/actions/tasks";

export const queryKeys = {
  tasksByBoard: (boardId?: string) => ["tasks", "board", boardId] as const,
  tasksByBoardInfinite: (boardId?: string) => ["tasks", "board", "infinite", boardId] as const,
  tasksSummaryByList: (listId?: string) => ["tasks", "summary", "list", listId] as const,
  task: (taskId: string) => ["tasks", taskId] as const,
  taskSummary: (taskId: string) => ["tasks", "summary", taskId] as const,
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
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: initialData ? false : false, // Use cached data if available
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
  const queryClient = useQueryClient();
  
  // Get cached data to use as initialData
  const cachedData = taskId 
    ? queryClient.getQueryData<TaskWithRelations>(queryKeys.task(taskId))
    : null;

  return useQuery({
    queryKey: queryKeys.task(taskId || ""),
    queryFn: () => {
      if (!taskId) return null;
      return getTask(taskId, boardId);
    },
    enabled: !!taskId,
    initialData: cachedData, // Use cached/prefetched data if available
    staleTime: 30 * 1000, // 30 seconds - task data is fresh, prevents immediate refetch
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cached data if available
  });
}

/**
 * Infinite query hook for paginated task summaries by list
 * Use this for lazy loading tasks in kanban columns
 */
export function useTasksSummaryByList(
  listId: string,
  includeArchived = false
) {
  return useInfiniteQuery<PaginatedTaskSummaryResult, Error, InfiniteData<PaginatedTaskSummaryResult>, readonly ["tasks", "summary", "list", string | undefined], string | undefined>({
    queryKey: queryKeys.tasksSummaryByList(listId),
    queryFn: async ({ pageParam }) => {
      const pagination: PaginationParams = {
        limit: 20, // 20 tasks per page
        cursor: pageParam,
      };
      const result = await getTasksSummaryByList(listId, includeArchived, pagination);
      return result;
    },
    enabled: !!listId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextCursor;
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch full task details on demand
 * Use this when opening task detail modal
 */
export function useTaskDetails(taskId: string | null, boardId?: string) {
  return useTask(taskId, boardId); // Reuse existing hook with optimized settings
}

/**
 * Hook to fetch task summary (lightweight)
 */
export function useTaskSummary(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.taskSummary(taskId || ""),
    queryFn: () => {
      if (!taskId) return null;
      return getTaskSummary(taskId);
    },
    enabled: !!taskId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

/**
 * Hook to prefetch task details (Trello-style hover prefetching)
 * Use this to prefetch task details when user hovers over a card
 */
export function usePrefetchTaskDetails() {
  const queryClient = useQueryClient();

  return useCallback(
    (taskId: string, boardId?: string) => {
      // Check if already cached and fresh
      const cached = queryClient.getQueryData<TaskWithRelations>(
        queryKeys.task(taskId)
      );
      
      // Only prefetch if not cached or stale
      if (!cached) {
        queryClient.prefetchQuery({
          queryKey: queryKeys.task(taskId),
          queryFn: () => getTask(taskId, boardId),
          staleTime: 30 * 1000, // 30 seconds
        });
      }
    },
    [queryClient]
  );
}
