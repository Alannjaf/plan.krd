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
      queryClient.invalidateQueries({ queryKey: queryKeys.boards(variables.workspaceId) });
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
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });
}
