"use client";

import { Draggable } from "@hello-pangea/dnd";
import { Card } from "@/components/ui/card";
import { Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/actions/tasks";

interface KanbanCardProps {
  task: Task;
  index: number;
  onClick?: () => void;
}

const priorityColors = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function KanbanCard({ task, index, onClick }: KanbanCardProps) {
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() ? true : false;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={cn(
            "p-3 mb-2 cursor-pointer transition-all duration-200",
            "bg-card hover:bg-accent/50 border-border/50",
            "hover:border-primary/30 hover:shadow-md",
            snapshot.isDragging && "shadow-xl border-primary/50 rotate-2"
          )}
        >
          <h4 className="text-sm font-medium leading-tight mb-2">
            {task.title}
          </h4>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {task.priority && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                  priorityColors[task.priority]
                )}
              >
                <Flag className="w-3 h-3" />
                {priorityLabels[task.priority]}
              </span>
            )}

            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
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
          </div>
        </Card>
      )}
    </Draggable>
  );
}
