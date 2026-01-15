"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getTask } from "@/lib/actions/tasks";
import { queryKeys } from "@/lib/query/queries/tasks";

/**
 * Network-aware prefetch hook for task details
 * Respects network conditions and data saver settings
 */
export function usePrefetchTaskDetails() {
  const queryClient = useQueryClient();
  const [shouldPrefetch, setShouldPrefetch] = useState(true);

  useEffect(() => {
    // Check network conditions
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as any).connection;
      
      // Disable prefetch on slow connections
      if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") {
        setShouldPrefetch(false);
        return;
      }
      
      // Disable on data saver mode
      if (conn.saveData) {
        setShouldPrefetch(false);
        return;
      }
      
      // Disable on metered connections (optional - can be enabled if needed)
      // if (conn.saveData || (conn as any).downlink < 0.5) {
      //   setShouldPrefetch(false);
      //   return;
      // }
    }
    
    setShouldPrefetch(true);
  }, []);

  return useCallback(
    (taskId: string, boardId?: string) => {
      if (!shouldPrefetch) return;

      // Check if already cached and fresh
      const cached = queryClient.getQueryData(queryKeys.task(taskId));
      
      // Only prefetch if not cached
      if (!cached) {
        queryClient.prefetchQuery({
          queryKey: queryKeys.task(taskId),
          queryFn: () => getTask(taskId, boardId),
          staleTime: 30 * 1000, // 30 seconds
        });
      }
    },
    [queryClient, shouldPrefetch]
  );
}
