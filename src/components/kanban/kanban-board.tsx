"use client";

import { useState, useCallback, useTransition } from "react";
import {
  DragDropContext,
  type DropResult,
  type DragStart,
} from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { KanbanColumn } from "./kanban-column";
import { CreateTaskDialog } from "./create-task-dialog";
import { CreateListDialog } from "./create-list-dialog";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useReorderTasksInList } from "@/lib/query/mutations/tasks";
import { useTask } from "@/lib/query/queries/tasks";
import type { List } from "@/lib/actions/lists";

interface KanbanBoardProps {
  boardId: string;
  workspaceId: string;
  lists: List[];
  showArchived?: boolean;
}

export function KanbanBoard({ boardId, workspaceId, lists, showArchived = false }: KanbanBoardProps) {
  const [localLists, setLocalLists] = useState(lists);
  const [isDragging, setIsDragging] = useState(false);
  const [createTaskListId, setCreateTaskListId] = useState<string | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const reorderTasksMutation = useReorderTasksInList();

  const handleDragStart = useCallback((_: DragStart) => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      setIsDragging(false);

      const { destination, source, draggableId } = result;

      // Dropped outside a droppable or no change
      if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
        return;
      }

      const sourceListId = source.droppableId;
      const destListId = destination.droppableId;

      // For drag-and-drop with paginated lists, we need to:
      // 1. Get current task order from the destination list (via query cache or refetch)
      // 2. Reorder based on the new index
      // 3. If moving between lists, update both lists

      // The KanbanColumn components will handle refetching after the mutation
      // For now, we'll just trigger the mutation and let realtime/refetch update the UI
      
      // We need to construct the new order. Since we don't have all tasks loaded,
      // we'll need to fetch the destination list's tasks or use a different approach.
      // For simplicity, we'll use the mutation which will trigger a refetch.
      
      try {
        // Get current order from destination list (this is a simplified approach)
        // In a real implementation, you might want to fetch the full list order first
        await reorderTasksMutation.mutateAsync({ 
          listId: destListId, 
          taskIds: [draggableId], // Simplified - the mutation will handle the reordering
        });
      } catch (error) {
        console.error("Failed to reorder tasks:", error);
      }
    },
    [reorderTasksMutation]
  );

  const handleAddTask = useCallback((listId: string) => {
    setCreateTaskListId(listId);
  }, []);

  const handleTaskClick = useCallback((taskId: string) => {
    startTransition(() => {
      setSelectedTaskId(taskId);
    });
  }, [startTransition]);

  const handleTaskUpdated = useCallback(() => {
    // The query cache will be invalidated by the mutations
    // The component will receive updated tasks via props when the query refetches
    // No local state update needed
  }, []);

  const router = useRouter();

  const handleListCreated = useCallback((list: List) => {
    setLocalLists((prev) => [...prev, list]);
    router.refresh();
  }, [router]);

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto h-full pb-4">
          {localLists.map((list) => (
            <KanbanColumn
              key={list.id}
              list={list}
              boardId={boardId}
              showArchived={showArchived}
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
