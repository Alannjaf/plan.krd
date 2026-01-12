"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceMembers } from "@/lib/actions/assignees";

export const queryKeys = {
  workspaceMembers: (workspaceId: string) => ["members", workspaceId] as const,
};

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.workspaceMembers(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes - members don't change often
  });
}

/**
 * Pre-fetch workspace members when entering a workspace.
 * This ensures members are already cached when opening task modals,
 * making the @mention autocomplete instant.
 */
export function usePrefetchWorkspaceMembers(workspaceId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    // Check if already in cache and not stale
    const existing = queryClient.getQueryData(queryKeys.workspaceMembers(workspaceId));
    if (existing) return;

    // Prefetch members in the background
    queryClient.prefetchQuery({
      queryKey: queryKeys.workspaceMembers(workspaceId),
      queryFn: () => getWorkspaceMembers(workspaceId),
      staleTime: 5 * 60 * 1000,
    });
  }, [workspaceId, queryClient]);
}
