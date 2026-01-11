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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksByBoard() });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard());

      // Optimistically update
      const optimisticTask: TaskWithRelations = {
        id: `temp-${Date.now()}`,
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
        assignees: [],
        labels: [],
        subtasks: [],
        custom_field_values: [],
        attachments_count: 0,
        comments_count: 0,
      };

      queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(), (old) => {
        if (!old) return [optimisticTask];
        return [...old, optimisticTask];
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Restore previous value on error
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasksByBoard(), context.previousTasks);
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
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
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksByBoard() });
      await queryClient.cancelQueries({ queryKey: queryKeys.task(taskId) });

      const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard());
      const previousTask = queryClient.getQueryData<TaskWithRelations>(queryKeys.task(taskId));

      // Optimistically update
      queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(), (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === taskId ? { ...task, ...updates, updated_at: new Date().toISOString() } : task
        );
      });

      queryClient.setQueryData<TaskWithRelations>(queryKeys.task(taskId), (old) => {
        if (!old) return old;
        return { ...old, ...updates, updated_at: new Date().toISOString() };
      });

      return { previousTasks, previousTask };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasksByBoard(), context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(queryKeys.task(variables.taskId), context.previousTask);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
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
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksByBoard() });

      const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard());

      // Optimistically remove
      queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(), (old) => {
        if (!old) return old;
        return old.filter((task) => task.id !== taskId);
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasksByBoard(), context.previousTasks);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
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
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksByBoard() });

      const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard());

      queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(), (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === taskId
            ? {
                ...task,
                completed: true,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasksByBoard(), context.previousTasks);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
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
      await queryClient.cancelQueries({ queryKey: queryKeys.tasksByBoard() });

      const previousTasks = queryClient.getQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard());

      queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasksByBoard(), (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === taskId
            ? {
                ...task,
                completed: false,
                completed_at: null,
                updated_at: new Date().toISOString(),
              }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasksByBoard(), context.previousTasks);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByBoard() });
    },
  });
}
