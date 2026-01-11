"use client";

import { Droppable } from "@hello-pangea/dnd";
import { KanbanCard } from "./kanban-card";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { List } from "@/lib/actions/lists";
import type { Task } from "@/lib/actions/tasks";

interface KanbanColumnProps {
  list: List;
  tasks: Task[];
  onAddTask: (listId: string) => void;
  onTaskClick?: (task: Task) => void;
}

export function KanbanColumn({
  list,
  tasks,
  onAddTask,
  onTaskClick,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0 bg-secondary/30 rounded-xl border border-border/50">
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{list.name}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={list.id} type="TASK">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-2 min-h-[200px] transition-colors duration-200",
              snapshot.isDraggingOver && "bg-primary/5"
            )}
          >
            {tasks.map((task, index) => (
              <KanbanCard
                key={task.id}
                task={task}
                index={index}
                onClick={() => onTaskClick?.(task)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add Task Button */}
      <div className="p-2 border-t border-border/50">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => onAddTask(list.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add a task
        </Button>
      </div>
    </div>
  );
}
