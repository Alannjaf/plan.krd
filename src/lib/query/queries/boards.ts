"use client";

import { useQuery } from "@tanstack/react-query";
import { getBoards, getBoard, type Board } from "@/lib/actions/boards";

export const queryKeys = {
  boards: (workspaceId: string) => ["boards", workspaceId] as const,
  board: (boardId: string) => ["board", boardId] as const,
};

export function useBoards(workspaceId: string, includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.boards(workspaceId),
    queryFn: () => getBoards(workspaceId, includeArchived),
    enabled: !!workspaceId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cached data if available
  });
}

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: queryKeys.board(boardId),
    queryFn: () => getBoard(boardId),
    enabled: !!boardId,
  });
}
