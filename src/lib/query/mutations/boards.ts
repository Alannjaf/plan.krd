"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBoard,
  updateBoard,
  deleteBoard,
  archiveBoard,
  unarchiveBoard,
  type Board,
} from "@/lib/actions/boards";
import { queryKeys } from "../queries/boards";
import { showError, showSuccess } from "@/lib/utils/errors";

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      description,
    }: {
      workspaceId: string;
      name: string;
      description?: string;
    }) => {
      const result = await createBoard(workspaceId, name, description);
      if (!result.success) {
        throw new Error(result.error || "Failed to create board");
      }
      return result.board!;
    },
    onSuccess: (data, variables) => {
      showSuccess("Board created successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.boards(variables.workspaceId) });
    },
    onError: (err) => {
      showError(err, "Failed to create board");
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      boardId,
      updates,
    }: {
      boardId: string;
      updates: { name?: string; description?: string };
    }) => {
      const result = await updateBoard(boardId, updates);
      if (!result.success) {
        throw new Error(result.error || "Failed to update board");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Board updated successfully");
      // Invalidate all board queries since we don't know workspaceId here
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => {
      showError(err, "Failed to update board");
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boardId: string) => {
      const result = await deleteBoard(boardId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete board");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Board deleted successfully");
      // Invalidate all board queries since we don't know workspaceId here
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => {
      showError(err, "Failed to delete board");
    },
  });
}

export function useArchiveBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boardId: string) => {
      const result = await archiveBoard(boardId);
      if (!result.success) {
        throw new Error(result.error || "Failed to archive board");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Board archived successfully");
      // Invalidate all board queries since we don't know workspaceId here
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => {
      showError(err, "Failed to archive board");
    },
  });
}

export function useUnarchiveBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boardId: string) => {
      const result = await unarchiveBoard(boardId);
      if (!result.success) {
        throw new Error(result.error || "Failed to unarchive board");
      }
      return result;
    },
    onSuccess: () => {
      showSuccess("Board unarchived successfully");
      // Invalidate all board queries since we don't know workspaceId here
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (err) => {
      showError(err, "Failed to unarchive board");
    },
  });
}
