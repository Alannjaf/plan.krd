"use client";

import { useQuery } from "@tanstack/react-query";
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
