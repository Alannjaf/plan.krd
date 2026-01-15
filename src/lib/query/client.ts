"use client";

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s, then considered stale
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime) - keep in cache for 5 minutes
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Use stale-while-revalidate pattern instead
      refetchOnMount: false, // Use cached data if available, refetch in background
      refetchOnReconnect: true,
      // Stale-while-revalidate: show cached data immediately, refetch in background
      // This is achieved by setting refetchOnMount: false and refetchOnWindowFocus: false
      // while keeping staleTime short (30s) so data is refetched when needed
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations if offline - they'll be queued
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return false;
        }
        // Retry once for network errors
        return failureCount < 1;
      },
    },
  },
});
