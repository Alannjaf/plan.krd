"use client";

import { Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, Flag, CheckSquare, MessageSquare, Paperclip, Archive, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/lib/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";
import { completeTask, uncompleteTask } from "@/lib/actions/tasks";
import { useState } from "react";

interface KanbanCardProps {
  task: TaskWithRelations;
  index: number;
  onClick?: (taskId: string) => void;
}

const priorityColors = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function KanbanCard({ task, index, onClick }: KanbanCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !task.completed ? true : false;

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const hasSubtasks = totalSubtasks > 0;

  const handleCompletionToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleting(true);
    if (task.completed) {
      await uncompleteTask(task.id);
    } else {
      await completeTask(task.id);
    }
    setIsCompleting(false);
  };

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

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task.id)}
          className={cn(
            "p-3 mb-2 cursor-pointer transition-all duration-200",
            "bg-card hover:bg-accent/50 border-border/50",
            "hover:border-primary/30 hover:shadow-md",
            snapshot.isDragging && "shadow-xl border-primary/50 rotate-2",
            task.archived && "opacity-60 border-dashed bg-muted/30",
            task.completed && "opacity-70"
          )}
        >
          {/* Completion Checkbox and Archived Badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={task.completed}
                onCheckedChange={handleCompletionToggle}
                disabled={isCompleting}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
              {task.completed && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
            </div>
            {task.archived && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                <Archive className="w-3 h-3" />
                Archived
              </div>
            )}
          </div>

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.labels.slice(0, 3).map((label) => (
                <span
                  key={label.id}
                  className="h-2 w-8 rounded-full"
                  style={{ backgroundColor: label.labels.color }}
                  title={label.labels.name}
                />
              ))}
              {task.labels.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{task.labels.length - 3}
                </span>
              )}
            </div>
          )}

          <h4 className={cn(
            "text-sm font-medium leading-tight mb-2",
            task.completed && "line-through opacity-60"
          )}>
            {task.title}
          </h4>

          {/* Meta info row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {task.priority && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border",
                    priorityColors[task.priority]
                  )}
                >
                  <Flag className="w-3 h-3" />
                </span>
              )}

              {task.due_date && !task.completed && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                    isOverdue
                      ? "bg-red-500/20 text-red-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {new Date(task.due_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}

              {hasSubtasks && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    completedSubtasks === totalSubtasks
                      ? "text-green-500"
                      : "text-muted-foreground"
                  )}
                >
                  <CheckSquare className="w-3 h-3" />
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}

              {task.comments_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="w-3 h-3" />
                  {task.comments_count}
                </span>
              )}

              {task.attachments_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="w-3 h-3" />
                  {task.attachments_count}
                </span>
              )}
            </div>

            {/* Assignees */}
            {task.assignees && task.assignees.length > 0 && (
              <TooltipProvider>
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Tooltip key={assignee.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 border-2 border-card">
                          <AvatarImage
                            src={assignee.profiles.avatar_url || undefined}
                          />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(
                              assignee.profiles.full_name,
                              assignee.profiles.email
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        {assignee.profiles.full_name || assignee.profiles.email}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {task.assignees.length > 3 && (
                    <Avatar className="h-6 w-6 border-2 border-card bg-muted">
                      <AvatarFallback className="text-[10px]">
                        +{task.assignees.length - 3}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </TooltipProvider>
            )}
          </div>
        </Card>
      )}
    </Draggable>
  );
}
