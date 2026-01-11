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
import { queryKeys } from "../queries/subtasks";

export function useCreateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, title }: { taskId: string; title: string }) => {
      const result = await createSubtask(taskId, title);
      if (!result.success) {
        throw new Error(result.error || "Failed to create subtask");
      }
      return result.subtask!;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(variables.taskId) });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      updates,
    }: {
      subtaskId: string;
      updates: {
        title?: string;
        completed?: boolean;
        due_date?: string | null;
        assignee_id?: string | null;
      };
    }) => {
      const result = await updateSubtask(subtaskId, updates);
      if (!result.success) {
        throw new Error(result.error || "Failed to update subtask");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subtaskId: string) => {
      const result = await deleteSubtask(subtaskId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete subtask");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });
}

export function useToggleSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) => {
      const result = await toggleSubtask(subtaskId, completed);
      if (!result.success) {
        throw new Error(result.error || "Failed to toggle subtask");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks"] });
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(variables.taskId) });
    },
  });
}
