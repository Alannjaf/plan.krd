"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  archiveTask,
  unarchiveTask,
  completeTask,
  uncompleteTask,
  reorderTasksInList,
  type Task,
  type TaskWithRelations,
} from "@/lib/actions/tasks";
import { queryKeys } from "../queries/tasks";
import { showError, showSuccess, getErrorMessage } from "@/lib/utils/errors";

// Partial key for matching all board task caches
const TASKS_BOARD_PARTIAL_KEY = ["tasks", "board"] as const;

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      title,
      options,
    }: {
      listId: string;
      title: string;
      options?: {
        description?: string;
        priority?: "low" | "medium" | "high" | "urgent";
        start_date?: string;
        due_date?: string;
      };
    }) => {
      const result = await createTask(listId, title, options);
      if (!result.success) {
        throw new Error(result.error || "Failed to create task");
      }
      return result.task!;
    },
    onMutate: async ({ listId, title, options }) => {
      // Cancel outgoing refetches for all board queries
      await queryClient.cancelQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });

      // Snapshot all board caches
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });

      // Create temp ID to track optimistic task
      const tempId = `temp-${Date.now()}`;

      // Optimistically update all board caches
      const optimisticTask: TaskWithRelations = {
        id: tempId,
        list_id: listId,
        title,
        description: options?.description || null,
        priority: options?.priority || null,
        start_date: options?.start_date || null,
        due_date: options?.due_date || null,
        position: 0,
        archived: false,
        archived_at: null,
        completed: false,
        completed_at: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        share_token: null,
        share_enabled: false,
        assignees: [],
        labels: [],
        subtasks: [],
        custom_field_values: [],
        attachments_count: 0,
        comments_count: 0,
      };

      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(key, [...data, optimisticTask]);
        }
      });

      return { previousBoardQueries, tempId, listId, title };
    },
    onSuccess: (realTask, variables, context) => {
      if (!context) return;

      showSuccess("Task created successfully");

      // Convert Task to TaskWithRelations
      const realTaskWithRelations: TaskWithRelations = {
        ...realTask,
        assignees: [],
        labels: [],
        subtasks: [],
        custom_field_values: [],
        attachments_count: 0,
        comments_count: 0,
      };

      // Replace optimistic task with real task in all board caches
      const boardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });

      boardQueries.forEach(([key, data]) => {
        if (data) {
          const updatedTasks = data.map((task) => {
            // Find optimistic task by temp ID
            if (task.id === context.tempId) {
              return realTaskWithRelations;
            }
            return task;
          });
          queryClient.setQueryData<TaskWithRelations[]>(key, updatedTasks);
        }
      });

      // Update individual task cache
      queryClient.setQueryData(queryKeys.task(realTask.id), realTaskWithRelations);
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to create task");
      // Restore all previous values on error
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
    // No onSettled invalidation - Realtime handles sync
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: {
        title?: string;
        description?: string | null;
        priority?: "low" | "medium" | "high" | "urgent" | null;
        start_date?: string | null;
        due_date?: string | null;
      };
    }) => {
      const result = await updateTask(taskId, updates);
      if (!result.success) {
        throw new Error(result.error || "Failed to update task");
      }
      return result;
    },
    onMutate: async ({ taskId, updates }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
      await queryClient.cancelQueries({ queryKey: queryKeys.task(taskId) });

      // Snapshot all board caches
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });
      const previousTask = queryClient.getQueryData<TaskWithRelations>(queryKeys.task(taskId));

      // Optimistically update all board caches
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(
            key,
            data.map((task) =>
              task.id === taskId ? { ...task, ...updates, updated_at: new Date().toISOString() } : task
            )
          );
        }
      });

      queryClient.setQueryData<TaskWithRelations>(queryKeys.task(taskId), (old) => {
        if (!old) return old;
        return { ...old, ...updates, updated_at: new Date().toISOString() };
      });

      return { previousBoardQueries, previousTask };
    },
    onSuccess: () => {
      showSuccess("Task updated successfully");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to update task");
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.previousTask) {
        queryClient.setQueryData(queryKeys.task(variables.taskId), context.previousTask);
      }
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
    // No onSettled invalidation - Realtime handles sync
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deleteTask(taskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete task");
      }
      return result;
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });

      // Snapshot all board caches
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });

      // Optimistically remove from all caches
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(
            key,
            data.filter((task) => task.id !== taskId)
          );
        }
      });

      return { previousBoardQueries };
    },
    onSuccess: () => {
      showSuccess("Task deleted successfully");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to delete task");
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
    // No onSettled invalidation - Realtime handles sync
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      targetListId,
      newPosition,
    }: {
      taskId: string;
      targetListId: string;
      newPosition: number;
    }) => {
      const result = await moveTask(taskId, targetListId, newPosition);
      if (!result.success) {
        throw new Error(result.error || "Failed to move task");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Task moved successfully");
    },
    onError: (err) => {
      showError(err, "Failed to move task");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await archiveTask(taskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to archive task");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Task archived successfully");
    },
    onError: (err) => {
      showError(err, "Failed to archive task");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
  });
}

export function useUnarchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await unarchiveTask(taskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to unarchive task");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Task unarchived successfully");
    },
    onError: (err) => {
      showError(err, "Failed to unarchive task");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await completeTask(taskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to complete task");
      }
      return result;
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });

      // Snapshot all board caches
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });

      // Optimistically update all caches
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(
            key,
            data.map((task) =>
              task.id === taskId
                ? {
                  ...task,
                  completed: true,
                  completed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
                : task
            )
          );
        }
      });

      return { previousBoardQueries };
    },
    onSuccess: () => {
      showSuccess("Task completed");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to complete task");
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
    // No onSettled invalidation - Realtime handles sync
  });
}

export function useUncompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await uncompleteTask(taskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to uncomplete task");
      }
      return result;
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });

      // Snapshot all board caches
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });

      // Optimistically update all caches
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(
            key,
            data.map((task) =>
              task.id === taskId
                ? {
                  ...task,
                  completed: false,
                  completed_at: null,
                  updated_at: new Date().toISOString(),
                }
                : task
            )
          );
        }
      });

      return { previousBoardQueries };
    },
    onSuccess: () => {
      showSuccess("Task marked as incomplete");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to uncomplete task");
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      // Refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
    // No onSettled invalidation - Realtime handles sync
  });
}

export function useReorderTasksInList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, taskIds }: { listId: string; taskIds: string[] }) => {
      const result = await reorderTasksInList(listId, taskIds);
      if (!result.success) {
        throw new Error(result.error || "Failed to reorder tasks");
      }
      return result;
    },
    onMutate: async ({ listId, taskIds }) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });

      // Snapshot previous value
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: TASKS_BOARD_PARTIAL_KEY,
      });

      // Optimistically update
      previousBoardQueries.forEach(([key, data]) => {
        if (!data) return;

        const tasksInList = data.filter((t) => t.list_id === listId);
        const otherTasks = data.filter((t) => t.list_id !== listId);

        // Map of id -> task
        const taskMap = new Map(data.map(t => [t.id, t]));

        // Reconstruct the list based on taskIds order
        const reorderedTasks: TaskWithRelations[] = [];

        taskIds.forEach((id, index) => {
          const task = taskMap.get(id);
          if (task) {
            reorderedTasks.push({
              ...task,
              list_id: listId, // Ensure list_id is correct
              position: index, // Update position
              updated_at: new Date().toISOString()
            });
          }
        });

        const validReorderedIds = new Set(reorderedTasks.map(t => t.id));
        const keptOtherTasks = otherTasks.filter(t => !validReorderedIds.has(t.id));

        queryClient.setQueryData<TaskWithRelations[]>(key, [...keptOtherTasks, ...reorderedTasks]);
      });

      return { previousBoardQueries };
    },
    onSuccess: () => {
      showSuccess("Tasks reordered successfully");
    },
    onError: (err, variables, context) => {
      showError(err, "Failed to reorder tasks");
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_BOARD_PARTIAL_KEY });
    },
  });
}
