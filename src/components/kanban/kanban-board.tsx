"use client";

import { useState, useCallback } from "react";
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
import { reorderTasksInList, getTask, type TaskWithRelations } from "@/lib/actions/tasks";
import type { List } from "@/lib/actions/lists";

interface KanbanBoardProps {
  boardId: string;
  workspaceId: string;
  lists: List[];
  tasks: TaskWithRelations[];
}

export function KanbanBoard({ boardId, workspaceId, lists, tasks }: KanbanBoardProps) {
  const [localLists] = useState(lists);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [isDragging, setIsDragging] = useState(false);
  const [createTaskListId, setCreateTaskListId] = useState<string | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Group tasks by list
  const tasksByList = localTasks.reduce(
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
  Object.keys(tasksByList).forEach((listId) => {
    tasksByList[listId].sort((a, b) => a.position - b.position);
  });

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

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleTaskCreated = (task: TaskWithRelations) => {
    setLocalTasks((prev) => [...prev, task]);
    setCreateTaskListId(null);
  };

  const handleTaskUpdated = async () => {
    // Refetch the updated task and update local state
    if (selectedTaskId) {
      const updatedTask = await getTask(selectedTaskId);
      if (updatedTask) {
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        );
      }
    }
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
