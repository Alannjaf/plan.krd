"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
  reorderSubtasks,
  type Subtask,
} from "@/lib/actions/subtasks";
import { queryKeys as subtaskQueryKeys } from "../queries/subtasks";
import { queryKeys as taskQueryKeys } from "../queries/tasks";
import type { TaskWithRelations } from "@/lib/actions/tasks";

export function useCreateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      title,
      due_date,
      assignee_id,
    }: {
      taskId: string;
      title: string;
      due_date?: string | null;
      assignee_id?: string | null;
    }) => {
      const result = await createSubtask(taskId, title, due_date, assignee_id);
      if (!result.success) {
        throw new Error(result.error || "Failed to create subtask");
      }
      return { subtask: result.subtask!, taskId };
    },
    onMutate: async ({ taskId, title, due_date, assignee_id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.task(taskId) });
      await queryClient.cancelQueries({ queryKey: ["tasks", "board"] });

      // Snapshot previous values
      const previousTask = queryClient.getQueryData<TaskWithRelations>(taskQueryKeys.task(taskId));
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: ["tasks", "board"],
      });

      // Optimistic subtask
      const optimisticSubtask = {
        id: `temp-${Date.now()}`,
        title,
        completed: false,
        position: (previousTask?.subtasks?.length || 0),
        due_date: due_date || null,
        assignee_id: assignee_id || null,
        assignee: null, // Will be populated when real data arrives
      };

      // Update task cache - only if task exists in cache
      if (previousTask) {
        queryClient.setQueryData<TaskWithRelations>(taskQueryKeys.task(taskId), (old) => {
          if (!old) return old;
          const newSubtasks = [...(old.subtasks || []), optimisticSubtask];
          // Create new object to ensure React detects the change
          return {
            ...old,
            subtasks: newSubtasks,
          };
        });
      }

      // Update board tasks cache
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(key, (old) => {
            if (!old) return old;
            // Create new array with new task objects to ensure React detects changes
            return old.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: [...(task.subtasks || []), optimisticSubtask],
                  }
                : task
            );
          });
        }
      });

      return { previousTask, previousBoardQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(taskQueryKeys.task(variables.taskId), context.previousTask);
      }
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (data, variables) => {
      // Replace optimistic subtask with real one
      const realSubtask = {
        id: data.subtask.id,
        title: data.subtask.title,
        completed: data.subtask.completed,
        position: data.subtask.position,
        due_date: data.subtask.due_date,
        assignee_id: data.subtask.assignee_id,
        assignee: data.subtask.assignee || null,
      };

      let taskCacheUpdated = false;

      // Update task cache - replace optimistic with real subtask
      queryClient.setQueryData<TaskWithRelations>(taskQueryKeys.task(variables.taskId), (old) => {
        if (!old) return old;
        taskCacheUpdated = true;
        const filtered = (old.subtasks || []).filter((s) => !s.id.startsWith("temp-"));
        const newSubtasks = [...filtered, realSubtask].sort((a, b) => a.position - b.position);
        // Create completely new object to ensure React detects the change
        return {
          ...old,
          subtasks: newSubtasks,
        };
      });

      // Update board tasks cache
      queryClient.getQueriesData<TaskWithRelations[]>({ queryKey: ["tasks", "board"] }).forEach(([key]) => {
        queryClient.setQueryData<TaskWithRelations[]>(key, (old) => {
          if (!old) return old;
          // Create new array with new task objects to ensure React detects changes
          return old.map((task) => {
            if (task.id === variables.taskId) {
              const filtered = (task.subtasks || []).filter((s) => !s.id.startsWith("temp-"));
              const newSubtasks = [...filtered, realSubtask].sort((a, b) => a.position - b.position);
              return {
                ...task,
                subtasks: newSubtasks,
              };
            }
            return task;
          });
        });
      });

      // Fallback: If task wasn't in cache, invalidate to trigger refetch
      // This ensures the UI updates even if the cache wasn't populated
      if (!taskCacheUpdated) {
        queryClient.invalidateQueries({ queryKey: taskQueryKeys.task(variables.taskId) });
      }

      // Note: Realtime subscriptions also handle live updates
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      updates,
      taskId,
      assignee,
    }: {
      subtaskId: string;
      updates: {
        title?: string;
        completed?: boolean;
        due_date?: string | null;
        assignee_id?: string | null;
      };
      taskId: string;
      assignee?: {
        id: string;
        email: string | null;
        full_name: string | null;
        avatar_url: string | null;
      } | null;
    }) => {
      const result = await updateSubtask(subtaskId, updates);
      if (!result.success) {
        throw new Error(result.error || "Failed to update subtask");
      }
      return { subtaskId, updates, taskId, assignee };
    },
    onMutate: async ({ subtaskId, updates, taskId, assignee }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.task(taskId) });
      await queryClient.cancelQueries({ queryKey: ["tasks", "board"] });

      // Snapshot previous values
      const previousTask = queryClient.getQueryData<TaskWithRelations>(taskQueryKeys.task(taskId));
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: ["tasks", "board"],
      });

      // Optimistically update subtask - include assignee profile if provided
      const updateSubtaskInTask = (task: TaskWithRelations): TaskWithRelations => {
        return {
          ...task,
          subtasks: (task.subtasks || []).map((subtask) =>
            subtask.id === subtaskId
              ? {
                  ...subtask,
                  ...updates,
                  // Include assignee profile if assignee_id is being updated
                  assignee: updates.assignee_id !== undefined ? assignee || null : subtask.assignee,
                }
              : subtask
          ),
        };
      };

      // Update task cache
      queryClient.setQueryData<TaskWithRelations>(taskQueryKeys.task(taskId), (old) => {
        if (!old) return old;
        return updateSubtaskInTask(old);
      });

      // Update board tasks cache
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(key, (old) => {
            if (!old) return old;
            return old.map((task) => (task.id === taskId ? updateSubtaskInTask(task) : task));
          });
        }
      });

      return { previousTask, previousBoardQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(taskQueryKeys.task(variables.taskId), context.previousTask);
      }
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    // Note: Realtime subscriptions handle live updates, no need to invalidate
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subtaskId, taskId }: { subtaskId: string; taskId: string }) => {
      const result = await deleteSubtask(subtaskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete subtask");
      }
      return { subtaskId, taskId };
    },
    onMutate: async ({ subtaskId, taskId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.task(taskId) });
      await queryClient.cancelQueries({ queryKey: ["tasks", "board"] });

      // Snapshot previous values
      const previousTask = queryClient.getQueryData<TaskWithRelations>(taskQueryKeys.task(taskId));
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: ["tasks", "board"],
      });

      // Optimistically remove subtask
      const removeSubtaskFromTask = (task: TaskWithRelations): TaskWithRelations => {
        return {
          ...task,
          subtasks: (task.subtasks || []).filter((subtask) => subtask.id !== subtaskId),
        };
      };

      // Update task cache
      queryClient.setQueryData<TaskWithRelations>(taskQueryKeys.task(taskId), (old) => {
        if (!old) return old;
        return removeSubtaskFromTask(old);
      });

      // Update board tasks cache
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(key, (old) => {
            if (!old) return old;
            return old.map((task) => (task.id === taskId ? removeSubtaskFromTask(task) : task));
          });
        }
      });

      return { previousTask, previousBoardQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(taskQueryKeys.task(variables.taskId), context.previousTask);
      }
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    // Note: Realtime subscriptions handle live updates, no need to invalidate
  });
}

export function useToggleSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subtaskId, completed, taskId }: { subtaskId: string; completed: boolean; taskId: string }) => {
      const result = await toggleSubtask(subtaskId, completed);
      if (!result.success) {
        throw new Error(result.error || "Failed to toggle subtask");
      }
      return { subtaskId, completed, taskId };
    },
    onMutate: async ({ subtaskId, completed, taskId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.task(taskId) });
      await queryClient.cancelQueries({ queryKey: ["tasks", "board"] });

      // Snapshot previous values
      const previousTask = queryClient.getQueryData<TaskWithRelations>(taskQueryKeys.task(taskId));
      const previousBoardQueries = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: ["tasks", "board"],
      });

      // Optimistically toggle subtask
      const toggleSubtaskInTask = (task: TaskWithRelations): TaskWithRelations => {
        return {
          ...task,
          subtasks: (task.subtasks || []).map((subtask) =>
            subtask.id === subtaskId
              ? { ...subtask, completed }
              : subtask
          ),
        };
      };

      // Update task cache
      queryClient.setQueryData<TaskWithRelations>(taskQueryKeys.task(taskId), (old) => {
        if (!old) return old;
        return toggleSubtaskInTask(old);
      });

      // Update board tasks cache
      previousBoardQueries.forEach(([key, data]) => {
        if (data) {
          queryClient.setQueryData<TaskWithRelations[]>(key, (old) => {
            if (!old) return old;
            return old.map((task) => (task.id === taskId ? toggleSubtaskInTask(task) : task));
          });
        }
      });

      return { previousTask, previousBoardQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(taskQueryKeys.task(variables.taskId), context.previousTask);
      }
      context?.previousBoardQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    // Note: Realtime subscriptions handle live updates, no need to invalidate
  });
}

export function useReorderSubtasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, subtaskIds }: { taskId: string; subtaskIds: string[] }) => {
      const result = await reorderSubtasks(taskId, subtaskIds);
      if (!result.success) {
        throw new Error(result.error || "Failed to reorder subtasks");
      }
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: subtaskQueryKeys.subtasks(variables.taskId) });
    },
  });
}
