"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  DragDropContext,
  type DropResult,
  type DragStart,
} from "@hello-pangea/dnd";
import { KanbanColumn } from "./kanban-column";
import { CreateTaskDialog } from "./create-task-dialog";
import { CreateListDialog } from "./create-list-dialog";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useReorderTasksInList } from "@/lib/query/mutations/tasks";
import { useTask } from "@/lib/query/queries/tasks";
import type { TaskWithRelations } from "@/lib/actions/tasks";
import type { List } from "@/lib/actions/lists";

interface KanbanBoardProps {
  boardId: string;
  workspaceId: string;
  lists: List[];
  tasks: TaskWithRelations[];
  showArchived?: boolean;
}

export function KanbanBoard({ boardId, workspaceId, lists, tasks, showArchived = false }: KanbanBoardProps) {
  const [localLists] = useState(lists);
  // Only use local state for drag-and-drop optimistic updates
  const [dragTasks, setDragTasks] = useState<TaskWithRelations[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [createTaskListId, setCreateTaskListId] = useState<string | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const reorderTasksMutation = useReorderTasksInList();

  // Clear drag state when tasks prop changes (if not currently dragging)
  useEffect(() => {
    if (!isDragging && dragTasks !== null) {
      setDragTasks(null);
    }
  }, [tasks, isDragging, dragTasks]);

  // Use tasks prop directly, or dragTasks during drag operations
  const currentTasks = dragTasks ?? tasks;

  // Group tasks by list - use useMemo for consistency
  const tasksByList = useMemo(() => {
    const grouped = currentTasks.reduce(
      (acc, task) => {
        if (!acc[task.list_id]) {
          acc[task.list_id] = [];
        }
        acc[task.list_id].push(task);
        return acc;
      },
      {} as Record<string, TaskWithRelations[]>
    );

    // Sort tasks by position within each list
    Object.keys(grouped).forEach((listId) => {
      grouped[listId].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [currentTasks]);

  const handleDragStart = useCallback((_: DragStart) => {
    setIsDragging(true);
    // Set drag state for optimistic updates during drag
    setDragTasks([...tasks]);
  }, [tasks]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDragging(false);

      const { destination, source, draggableId } = result;

      // Dropped outside a droppable
      if (!destination) {
        // Clear drag state if dropped outside
        setDragTasks(null);
        return;
      }

      // No change
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        // Clear drag state if no change
        setDragTasks(null);
        return;
      }

      const sourceListId = source.droppableId;
      const destListId = destination.droppableId;

      // Use current tasks (either from drag state or props)
      const currentTasksForDrag = dragTasks ?? tasks;

      // Optimistically update the UI immediately
      const optimisticTasks = [...currentTasksForDrag];
      const taskIndex = optimisticTasks.findIndex((t) => t.id === draggableId);
      if (taskIndex !== -1) {
        const [movedTask] = optimisticTasks.splice(taskIndex, 1);

        // Update the list_id if moving to a different list
        if (sourceListId !== destListId) {
          movedTask.list_id = destListId;
        }

        // Get tasks in destination list (excluding the moved task)
        const destTasks = optimisticTasks.filter((t) => t.list_id === destListId);

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
          const sourceTasks = optimisticTasks.filter((t) => t.list_id === sourceListId);
          sourceTasks.sort((a, b) => a.position - b.position);
          sourceTasks.forEach((task, index) => {
            task.position = index;
          });
        }

        // Apply optimistic update
        const finalTasks = [...optimisticTasks.filter((t) => t.list_id !== destListId), ...destTasks];
        setDragTasks(finalTasks);
      }

      // Prepare data for mutation
      const destTasksForMutation = currentTasksForDrag
        .filter((t) => t.list_id === destListId || t.id === draggableId)
        .map((t) => (t.id === draggableId ? { ...t, list_id: destListId } : t));

      // Get the new order
      const reorderedIds = [...destTasksForMutation]
        .filter((t) => t.list_id === destListId)
        .sort((a, b) => {
          if (a.id === draggableId) return destination.index - destTasksForMutation.indexOf(b);
          if (b.id === draggableId) return destTasksForMutation.indexOf(a) - destination.index;
          return a.position - b.position;
        })
        .map((t) => t.id);

      // Remove duplicates and ensure correct order
      const uniqueIds = Array.from(new Set(reorderedIds));
      const taskId = draggableId;
      const filteredIds = uniqueIds.filter((id) => id !== taskId);
      filteredIds.splice(destination.index, 0, taskId);

      try {
        await reorderTasksMutation.mutateAsync({ listId: destListId, taskIds: filteredIds });
        // Keep drag state until realtime updates the props
        // The useEffect will clear it when tasks prop updates
      } catch (error) {
        console.error("Failed to reorder tasks:", error);
        // Revert optimistic update on error - clear drag state to use props
        setDragTasks(null);
      }
    },
    [dragTasks, tasks, reorderTasksMutation]
  );

  const handleAddTask = (listId: string) => {
    setCreateTaskListId(listId);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleTaskUpdated = () => {
    // The query cache will be invalidated by the mutations
    // The component will receive updated tasks via props when the query refetches
    // No local state update needed
  };

  const handleListCreated = (list: List) => {
    // Refresh the page to get the new list
    window.location.reload();
  };

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto h-full pb-4">
          {localLists.map((list) => (
            <KanbanColumn
              key={list.id}
              list={list}
              tasks={tasksByList[list.id] || []}
              onAddTask={handleAddTask}
              onTaskClick={handleTaskClick}
            />
          ))}

          {/* Add Column Button */}
          <div className="w-72 shrink-0">
            <Button
              variant="outline"
              className="w-full h-12 border-dashed border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50"
              onClick={() => setShowCreateList(true)}
            >
              <Plus className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
              Add another list
            </Button>
          </div>
        </div>
      </DragDropContext>

      <CreateTaskDialog
        open={!!createTaskListId}
        onOpenChange={(open) => !open && setCreateTaskListId(null)}
        listId={createTaskListId || ""}
      />

      <CreateListDialog
        open={showCreateList}
        onOpenChange={setShowCreateList}
        boardId={boardId}
        onListCreated={handleListCreated}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        boardId={boardId}
        workspaceId={workspaceId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onTaskUpdated={handleTaskUpdated}
      />
    </>
  );
}
