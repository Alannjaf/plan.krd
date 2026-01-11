"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  markAsRead,
  deleteNotification,
  type Notification,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { AtSign, UserPlus, MessageSquare, Clock, X } from "lucide-react";

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const typeIcons = {
  mention: AtSign,
  assignment: UserPlus,
  comment: MessageSquare,
  due_date: Clock,
};

const typeColors = {
  mention: "text-blue-400",
  assignment: "text-green-400",
  comment: "text-purple-400",
  due_date: "text-orange-400",
};

export function NotificationItem({
  notification,
  onRead,
  onDelete,
}: NotificationItemProps) {
  const router = useRouter();
  const Icon = typeIcons[notification.type];

  const getInitials = (name: string | null) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return "??";
  };

  const handleClick = async () => {
    if (!notification.read) {
      await markAsRead(notification.id);
      onRead(notification.id);
    }

    // Navigate to the task if available
    if (notification.task_id && notification.workspace_id && notification.board_id) {
      router.push(
        `/${notification.workspace_id}/${notification.board_id}?task=${notification.task_id}`
      );
    } else if (notification.workspace_id && notification.board_id) {
      router.push(`/${notification.workspace_id}/${notification.board_id}`);
    } else if (notification.workspace_id) {
      router.push(`/${notification.workspace_id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(notification.id);
    onDelete(notification.id);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50 group",
        !notification.read && "bg-primary/5"
      )}
      onClick={handleClick}
    >
      <div className="relative shrink-0">
        {notification.actor ? (
          <Avatar className="h-10 w-10">
            <AvatarImage src={notification.actor.avatar_url || undefined} />
            <AvatarFallback>
              {getInitials(notification.actor.full_name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Icon className={cn("h-5 w-5", typeColors[notification.type])} />
          </div>
        )}
        {notification.actor && (
          <div
            className={cn(
              "absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-background flex items-center justify-center",
              typeColors[notification.type]
            )}
          >
            <Icon className="h-3 w-3" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm", !notification.read && "font-medium")}>
            {notification.title}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDelete}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {notification.message && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
      )}
    </div>
  );
}
