"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  getTaskActivities,
  getActivityMessage,
  type TaskActivity,
} from "@/lib/actions/activities";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface ActivityLogProps {
  taskId: string;
}

export function ActivityLog({ taskId }: ActivityLogProps) {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [taskId]);

  const loadActivities = async () => {
    setIsLoading(true);
    const data = await getTaskActivities(taskId);
    setActivities(data);
    setIsLoading(false);
  };

  const displayedActivities = isExpanded ? activities : activities.slice(0, 5);

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No activity yet
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {displayedActivities.map((activity) => {
          const userName =
            activity.profiles?.full_name ||
            activity.profiles?.email ||
            "Unknown";
          const message = getActivityMessage(activity, userName);

          return (
            <div key={activity.id} className="flex items-start gap-3">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={activity.profiles?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(
                    activity.profiles?.full_name || null,
                    activity.profiles?.email || null
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{userName}</span>{" "}
                  <span className="text-muted-foreground">
                    {message.replace(userName, "").trim()}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {activities.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show {activities.length - 5} more
            </>
          )}
        </Button>
      )}
    </div>
  );
}
