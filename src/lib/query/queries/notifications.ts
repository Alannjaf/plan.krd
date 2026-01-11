"use client";

import { useQuery } from "@tanstack/react-query";
import { getNotifications, getUnreadCount, type Notification } from "@/lib/actions/notifications";

export const queryKeys = {
  notifications: () => ["notifications"] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
};

export function useNotifications(limit: number = 20) {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => getNotifications(limit),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: () => getUnreadCount(),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}
