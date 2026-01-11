"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createList, updateList, deleteList, reorderLists, type List } from "@/lib/actions/lists";
import { queryKeys } from "../queries/lists";

export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boardId, name }: { boardId: string; name: string }) => {
      const result = await createList(boardId, name);
      if (!result.success) {
        throw new Error(result.error || "Failed to create list");
      }
      return result.list!;
    },
    onMutate: async ({ boardId, name }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.lists(boardId) });

      const previousLists = queryClient.getQueryData<List[]>(queryKeys.lists(boardId));

      const optimisticList: List = {
        id: `temp-${Date.now()}`,
        board_id: boardId,
        name,
        position: 0,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<List[]>(queryKeys.lists(boardId), (old) => {
        if (!old) return [optimisticList];
        return [...old, optimisticList];
      });

      return { previousLists };
    },
    onError: (err, variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(queryKeys.lists(variables.boardId), context.previousLists);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists(variables.boardId) });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, updates }: { listId: string; updates: { name?: string } }) => {
      const result = await updateList(listId, updates);
      if (!result.success) {
        throw new Error(result.error || "Failed to update list");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      const result = await deleteList(listId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete list");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });
}

export function useReorderLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boardId, listIds }: { boardId: string; listIds: string[] }) => {
      const result = await reorderLists(boardId, listIds);
      if (!result.success) {
        throw new Error(result.error || "Failed to reorder lists");
      }
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists(variables.boardId) });
    },
  });
}
