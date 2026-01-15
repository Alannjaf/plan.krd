"use client";

import { memo, useMemo, useState, useEffect, useRef } from "react";
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
import { useCompleteTask, useUncompleteTask } from "@/lib/query/mutations/tasks";
import { usePrefetchTaskDetails } from "@/lib/hooks/use-prefetch-task";
import type * as CheckboxPrimitive from "@radix-ui/react-checkbox";

interface KanbanCardProps {
  task: TaskWithRelations;
  index: number;
  boardId?: string;
  onClick?: (taskId: string) => void;
}

const priorityColors = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
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

function KanbanCardComponent({ task, index, boardId, onClick }: KanbanCardProps) {
  const completeTaskMutation = useCompleteTask();
  const uncompleteTaskMutation = useUncompleteTask();
  const prefetchTaskDetails = usePrefetchTaskDetails();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced prefetch on hover (300ms delay - Trello-style)
  useEffect(() => {
    if (isHovered && boardId) {
      hoverTimeoutRef.current = setTimeout(() => {
        prefetchTaskDetails(task.id, boardId);
      }, 300); // 300ms debounce to avoid overfetching

      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
      };
    }
  }, [isHovered, task.id, boardId, prefetchTaskDetails]);
  
  const isOverdue = useMemo(() => {
    if (!task.due_date || task.completed) return false;
    return new Date(task.due_date) < new Date();
  }, [task.due_date, task.completed]);

  const subtaskStats = useMemo(() => {
    const total = task.subtasks?.length || 0;
    const completed = task.subtasks?.filter((s) => s.completed).length || 0;
    return { total, completed, hasSubtasks: total > 0 };
  }, [task.subtasks]);

  const formattedDueDate = useMemo(() => {
    if (!task.due_date) return null;
    const date = new Date(task.due_date);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[date.getMonth()]} ${date.getDate()}`;
  }, [task.due_date]);

  const handleCompletionToggle = async (checked: CheckboxPrimitive.CheckedState) => {
    if (task.completed) {
      uncompleteTaskMutation.mutate(task.id);
    } else {
      completeTaskMutation.mutate(task.id);
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          role="button"
          aria-label={`Task: ${task.title}${task.priority ? `, Priority: ${task.priority}` : ""}${task.due_date ? `, Due: ${formattedDueDate}` : ""}`}
          tabIndex={0}
          {...provided.dragHandleProps}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            // Cancel prefetch if user moves away
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
          }}
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
                disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending}
                className="h-4 w-4"
                onClick={(e) => e.stopPropagation()}
                aria-label={task.completed ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as complete`}
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
                  suppressHydrationWarning
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border",
                    priorityColors[task.priority]
                  )}
                >
                  <Flag className="w-3 h-3" />
                </span>
              )}

              {task.due_date && !task.completed && formattedDueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                    isOverdue
                      ? "bg-red-500/20 text-red-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  {formattedDueDate}
                </span>
              )}

              {subtaskStats.hasSubtasks && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    subtaskStats.completed === subtaskStats.total
                      ? "text-green-500"
                      : "text-muted-foreground"
                  )}
                >
                  <CheckSquare className="w-3 h-3" />
                  {subtaskStats.completed}/{subtaskStats.total}
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
                            loading="lazy"
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

export const KanbanCard = memo(KanbanCardComponent, (prevProps, nextProps) => {
  // Custom comparator: only re-render if task data changed
  const prev = prevProps.task;
  const next = nextProps.task;
  
  return (
    prev.id === next.id &&
    prev.title === next.title &&
    prev.position === next.position &&
    prev.priority === next.priority &&
    prev.due_date === next.due_date &&
    prev.completed === next.completed &&
    prev.archived === next.archived &&
    prev.attachments_count === next.attachments_count &&
    prev.comments_count === next.comments_count &&
    prev.subtasks?.length === next.subtasks?.length &&
    prev.assignees?.length === next.assignees?.length &&
    prev.labels?.length === next.labels?.length &&
    prevProps.index === nextProps.index &&
    prevProps.onClick === nextProps.onClick
  );
});
