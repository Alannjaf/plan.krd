"use client";

import { useState, useMemo, memo } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { KanbanCard } from "./kanban-card";
import { ColumnToolbar, type SortOption, type FilterPriority, type FilterDueDate } from "./column-toolbar";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { List } from "@/lib/actions/lists";
import type { TaskWithRelations } from "@/lib/actions/tasks";

interface KanbanColumnProps {
  list: List;
  tasks: TaskWithRelations[];
  onAddTask: (listId: string) => void;
  onTaskClick?: (taskId: string) => void;
  readOnly?: boolean;
}

// Priority order for sorting
const priorityOrder: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const KanbanColumn = memo(function KanbanColumn({
  list,
  tasks,
  onAddTask,
  onTaskClick,
  readOnly = false,
}: KanbanColumnProps) {
  // Per-column filter and sort state
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [filterDueDate, setFilterDueDate] = useState<FilterDueDate>("all");

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by priority
    if (filterPriority !== "all") {
      filtered = filtered.filter((task) => task.priority === filterPriority);
    }

    // Filter by due date
    if (filterDueDate !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      filtered = filtered.filter((task) => {
        if (filterDueDate === "no-date") {
          return !task.due_date;
        }
        if (!task.due_date) return false;

        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);

        switch (filterDueDate) {
          case "overdue":
            return dueDate < today;
          case "today":
            return dueDate.getTime() === today.getTime();
          case "week":
            return dueDate >= today && dueDate <= weekFromNow;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tasks, filterPriority, filterDueDate]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    if (sortBy === "position") {
      return [...filteredTasks].sort((a, b) => a.position - b.position);
    }

    return [...filteredTasks].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "due-asc":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case "due-desc":
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
        case "priority-desc":
          return (priorityOrder[b.priority || "medium"] || 0) - (priorityOrder[a.priority || "medium"] || 0);
        case "priority-asc":
          return (priorityOrder[a.priority || "medium"] || 0) - (priorityOrder[b.priority || "medium"] || 0);
        case "created-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "created-asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return a.position - b.position;
      }
    });
  }, [filteredTasks, sortBy]);

  const filteredCount = tasks.length - sortedTasks.length;

  return (
    <div 
      className="flex flex-col w-72 shrink-0 bg-secondary/30 rounded-xl border border-border/50"
      role="region"
      aria-label={`Column: ${list.name}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm" id={`column-${list.id}-title`}>{list.name}</h3>
          <span 
            className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
            aria-label={`${sortedTasks.length} tasks${filteredCount > 0 ? ` out of ${tasks.length}` : ""}`}
          >
            {sortedTasks.length}
            {filteredCount > 0 && (
              <span className="text-muted-foreground/50">/{tasks.length}</span>
            )}
          </span>
        </div>
        <ColumnToolbar
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
          filterDueDate={filterDueDate}
          onFilterDueDateChange={setFilterDueDate}
        />
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={list.id} type="TASK" isDropDisabled={readOnly}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-2 min-h-[200px] transition-colors duration-200 overflow-y-auto",
              snapshot.isDraggingOver && "bg-primary/5",
              readOnly && "cursor-default"
            )}
            role="group"
            aria-labelledby={`column-${list.id}-title`}
            aria-label={`Task list for ${list.name}`}
          >
            {sortedTasks.map((task, index) => (
              <KanbanCard
                key={task.id}
                task={task}
                index={index}
                onClick={() => onTaskClick?.(task.id)}
              />
            ))}
            {provided.placeholder}

            {/* Empty state when filtered */}
            {sortedTasks.length === 0 && tasks.length > 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No tasks match filters
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs h-7"
                  onClick={() => {
                    setFilterPriority("all");
                    setFilterDueDate("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}
      </Droppable>

      {/* Add Task Button */}
      {!readOnly && (
        <div className="p-2 border-t border-border/50">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={() => onAddTask(list.id)}
            aria-label={`Add task to ${list.name} column`}
          >
            <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" aria-hidden="true" />
            Add a task
          </Button>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparator: only re-render if relevant props changed
  return (
    prevProps.list.id === nextProps.list.id &&
    prevProps.list.name === nextProps.list.name &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.tasks === nextProps.tasks && // Reference equality for tasks array
    prevProps.onAddTask === nextProps.onAddTask &&
    prevProps.onTaskClick === nextProps.onTaskClick
  );
});
