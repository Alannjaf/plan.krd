"use client";

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutes (Realtime handles updates)
      gcTime: 1000 * 60 * 60, // 60 minutes
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Realtime handles updates
      refetchOnReconnect: true,
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
