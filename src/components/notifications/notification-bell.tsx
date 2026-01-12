"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Loader2 } from "lucide-react";
import { NotificationItem } from "./notification-item";
import {
  markAllAsRead,
  type Notification,
} from "@/lib/actions/notifications";
import { useNotifications, useUnreadCount, queryKeys } from "@/lib/query/queries/notifications";
import { useRealtimeNotifications } from "@/lib/hooks/use-realtime-notifications";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const queryClient = useQueryClient();
  
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();

  // Get user ID for realtime subscription
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  // Subscribe to realtime notifications
  useRealtimeNotifications(userId);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
  };

  const handleNotificationRead = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
  };

  const handleNotificationDelete = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleNotificationRead}
                  onDelete={handleNotificationDelete}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
