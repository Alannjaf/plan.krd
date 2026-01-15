"use client";

import { useState, useMemo, memo, useEffect, useRef, useCallback } from "react";
import { Droppable } from "@hello-pangea/dnd";
// Note: Virtualization with drag-and-drop is complex. 
// For now, we'll use conditional rendering based on task count.
// Full virtualization can be added later with a drag-and-drop compatible solution.
import { KanbanCard } from "./kanban-card";
import { ColumnToolbar, type SortOption, type FilterPriority, type FilterDueDate } from "./column-toolbar";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasksSummaryByList, queryKeys } from "@/lib/query/queries/tasks";
import { useQueryClient } from "@tanstack/react-query";
import type { List } from "@/lib/actions/lists";
import type { TaskSummary, TaskWithRelations, PaginatedTaskSummaryResult } from "@/lib/actions/tasks";

interface KanbanColumnProps {
  list: List;
  boardId: string;
  showArchived?: boolean;
  onAddTask: (listId: string) => void;
  onTaskClick?: (taskId: string) => void;
  readOnly?: boolean;
}

// Helper to convert TaskSummary to minimal TaskWithRelations for KanbanCard
function taskSummaryToTaskWithRelations(summary: TaskSummary): TaskWithRelations {
  return {
    ...summary,
    description: null,
    start_date: null,
    archived_at: null,
    completed_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    share_token: null,
    share_enabled: false,
    assignees: [],
    labels: [],
    subtasks: [],
    custom_field_values: [],
  } as TaskWithRelations;
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
  boardId,
  showArchived = false,
  onAddTask,
  onTaskClick,
  readOnly = false,
}: KanbanColumnProps) {
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  
  // Fetch task summaries for this list
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useTasksSummaryByList(list.id, showArchived);


  // Flatten all pages into a single array
  const taskSummaries = useMemo(() => {
    if (!data?.pages) return [];
    return (data.pages as PaginatedTaskSummaryResult[]).flatMap((page) => page.tasks);
  }, [data]);

  // Convert summaries to TaskWithRelations format
  const tasks = useMemo(() => {
    return taskSummaries.map(taskSummaryToTaskWithRelations);
  }, [taskSummaries]);

  // Per-column filter and sort state
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [filterDueDate, setFilterDueDate] = useState<FilterDueDate>("all");

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isLoading, isFetchingNextPage, fetchNextPage]);

  // Handle task click with cache pre-seeding for instant modal opening
  const handleTaskClick = useCallback((taskId: string) => {
    // Find the task summary in our current data
    const taskSummary = taskSummaries.find((t) => t.id === taskId);
    
    if (taskSummary) {
      // Pre-seed cache with summary data converted to TaskWithRelations
      // This allows modal to open instantly with at least summary data
      const partialTask = taskSummaryToTaskWithRelations(taskSummary);
      const existing = queryClient.getQueryData<TaskWithRelations>(queryKeys.task(taskId));
      
      // Only set if not already in cache (don't overwrite full details with summary)
      if (!existing) {
        queryClient.setQueryData(queryKeys.task(taskId), partialTask);
      }
    }
    
    // Call the parent's onTaskClick handler
    onTaskClick?.(taskId);
  }, [taskSummaries, queryClient, onTaskClick]);

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
              ref={(node) => {
                provided.innerRef(node);
                columnRef.current = node;
              }}
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
              {isLoading && tasks.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                // Render all tasks (virtualization disabled for drag-and-drop compatibility)
                // For very large lists, consider implementing a drag-and-drop compatible virtualization solution
                <>
                  {sortedTasks.map((task, index) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      index={index}
                      boardId={boardId}
                      onClick={() => handleTaskClick(task.id)}
                    />
                  ))}
                  {provided.placeholder}
                </>
              )}

              {/* Load more trigger */}
              {hasNextPage && (
                <div ref={loadMoreRef} className="h-4 flex items-center justify-center mt-2">
                  {isFetchingNextPage && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}

              {/* Load more button (fallback) */}
              {hasNextPage && !isFetchingNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => fetchNextPage()}
                >
                  Load more
                </Button>
              )}

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

              {/* Empty state when no tasks */}
              {sortedTasks.length === 0 && tasks.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    No tasks yet
                  </p>
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
    prevProps.boardId === nextProps.boardId &&
    prevProps.showArchived === nextProps.showArchived &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.onAddTask === nextProps.onAddTask &&
    prevProps.onTaskClick === nextProps.onTaskClick
  );
});
