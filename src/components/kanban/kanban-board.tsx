"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DragDropContext,
  type DropResult,
  type DragStart,
} from "@hello-pangea/dnd";
import { KanbanColumn } from "./kanban-column";
import { CreateTaskDialog } from "./create-task-dialog";
import { CreateListDialog } from "./create-list-dialog";
import { BoardToolbar, type SortOption, type FilterPriority, type FilterDueDate } from "./board-toolbar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { reorderTasksInList } from "@/lib/actions/tasks";
import type { List } from "@/lib/actions/lists";
import type { Task } from "@/lib/actions/tasks";

interface KanbanBoardProps {
  boardId: string;
  lists: List[];
  tasks: Task[];
}

// Priority order for sorting
const priorityOrder: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function KanbanBoard({ boardId, lists, tasks }: KanbanBoardProps) {
  const [localLists] = useState(lists);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [isDragging, setIsDragging] = useState(false);
  const [createTaskListId, setCreateTaskListId] = useState<string | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);

  // Filter and sort state
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [filterDueDate, setFilterDueDate] = useState<FilterDueDate>("all");

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...localTasks];

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
  }, [localTasks, filterPriority, filterDueDate]);

  // Sort tasks
  const sortTasks = useCallback((tasksToSort: Task[]): Task[] => {
    if (sortBy === "position") {
      return [...tasksToSort].sort((a, b) => a.position - b.position);
    }

    return [...tasksToSort].sort((a, b) => {
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
  }, [sortBy]);

  // Group and sort tasks by list
  const tasksByList = useMemo(() => {
    const grouped = filteredTasks.reduce(
      (acc, task) => {
        if (!acc[task.list_id]) {
          acc[task.list_id] = [];
        }
        acc[task.list_id].push(task);
        return acc;
      },
      {} as Record<string, Task[]>
    );

    // Sort tasks within each list
    Object.keys(grouped).forEach((listId) => {
      grouped[listId] = sortTasks(grouped[listId]);
    });

    return grouped;
  }, [filteredTasks, sortTasks]);

  const handleDragStart = useCallback((_: DragStart) => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDragging(false);

      const { destination, source, draggableId } = result;

      // Dropped outside a droppable
      if (!destination) return;

      // No change
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const sourceListId = source.droppableId;
      const destListId = destination.droppableId;

      // Optimistic update
      setLocalTasks((prevTasks) => {
        const newTasks = [...prevTasks];

        // Find the task being moved
        const taskIndex = newTasks.findIndex((t) => t.id === draggableId);
        if (taskIndex === -1) return prevTasks;

        const [movedTask] = newTasks.splice(taskIndex, 1);

        // Update the list_id if moving to a different list
        if (sourceListId !== destListId) {
          movedTask.list_id = destListId;
        }

        // Get tasks in destination list (excluding the moved task)
        const destTasks = newTasks.filter((t) => t.list_id === destListId);

        // Sort by position
        destTasks.sort((a, b) => a.position - b.position);

        // Insert at new position
        destTasks.splice(destination.index, 0, movedTask);

        // Update positions
        destTasks.forEach((task, index) => {
          task.position = index;
        });

        // If moving between lists, also update source list positions
        if (sourceListId !== destListId) {
          const sourceTasks = newTasks.filter((t) => t.list_id === sourceListId);
          sourceTasks.sort((a, b) => a.position - b.position);
          sourceTasks.forEach((task, index) => {
            task.position = index;
          });
        }

        return [...newTasks.filter((t) => t.list_id !== destListId), ...destTasks];
      });

      // Persist to database
      const destTasks = localTasks
        .filter((t) => t.list_id === destListId || t.id === draggableId)
        .map((t) => (t.id === draggableId ? { ...t, list_id: destListId } : t));

      // Get the new order
      const reorderedIds = [...destTasks]
        .filter((t) => t.list_id === destListId)
        .sort((a, b) => {
          if (a.id === draggableId) return destination.index - destTasks.indexOf(b);
          if (b.id === draggableId) return destTasks.indexOf(a) - destination.index;
          return a.position - b.position;
        })
        .map((t) => t.id);

      // Remove duplicates and ensure correct order
      const uniqueIds = Array.from(new Set(reorderedIds));
      const taskId = draggableId;
      const filteredIds = uniqueIds.filter((id) => id !== taskId);
      filteredIds.splice(destination.index, 0, taskId);

      await reorderTasksInList(destListId, filteredIds);
    },
    [localTasks]
  );

  const handleAddTask = (listId: string) => {
    setCreateTaskListId(listId);
  };

  const handleTaskCreated = (task: Task) => {
    setLocalTasks((prev) => [...prev, task]);
    setCreateTaskListId(null);
  };

  const handleListCreated = (list: List) => {
    // Refresh the page to get the new list
    window.location.reload();
  };

  return (
    <>
      <BoardToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        filterDueDate={filterDueDate}
        onFilterDueDateChange={setFilterDueDate}
      />

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto min-h-[calc(100vh-12rem)]">
          {localLists.map((list) => (
            <KanbanColumn
              key={list.id}
              list={list}
              tasks={tasksByList[list.id] || []}
              onAddTask={handleAddTask}
            />
          ))}

          {/* Add Column Button */}
          <div className="w-72 shrink-0">
            <Button
              variant="outline"
              className="w-full h-12 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50"
              onClick={() => setShowCreateList(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add another list
            </Button>
          </div>
        </div>
      </DragDropContext>

      <CreateTaskDialog
        open={!!createTaskListId}
        onOpenChange={(open) => !open && setCreateTaskListId(null)}
        listId={createTaskListId || ""}
        onTaskCreated={handleTaskCreated}
      />

      <CreateListDialog
        open={showCreateList}
        onOpenChange={setShowCreateList}
        boardId={boardId}
        onListCreated={handleListCreated}
      />
    </>
  );
}
