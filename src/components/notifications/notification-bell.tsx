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
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  type Notification,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadUnreadCount = async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  };

  const loadNotifications = async () => {
    setIsLoading(true);
    const data = await getNotifications();
    setNotifications(data);
    setIsLoading(false);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  const handleNotificationRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleNotificationDelete = (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (notification && !notification.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
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
