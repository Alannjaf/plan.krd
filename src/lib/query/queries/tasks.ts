"use client";

import { useQuery } from "@tanstack/react-query";
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
  });
}
