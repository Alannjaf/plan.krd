"use client";

import { useState } from "react";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, Lock } from "lucide-react";
import type { Board } from "@/lib/actions/boards";
import type { List } from "@/lib/actions/lists";
import type { TaskWithRelations } from "@/lib/actions/tasks";

interface PublicBoardViewProps {
  board: Board;
  lists: List[];
  tasks: TaskWithRelations[];
}

export function PublicBoardView({ board, lists, tasks }: PublicBoardViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Group tasks by list
  const tasksByList = tasks.reduce(
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

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Public View Banner */}
      <Alert className="rounded-none border-l-0 border-r-0 border-t-0 border-b">
        <Globe className="h-4 w-4" />
        <AlertDescription>
          You are viewing a public board in read-only mode. Changes cannot be saved.
        </AlertDescription>
      </Alert>

      {/* Board Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <div>
              <h1 className="font-semibold text-lg">{board.name}</h1>
              {board.description && (
                <p className="text-sm text-muted-foreground mt-1">{board.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Read-only Kanban Board */}
      <div className="flex-1 overflow-hidden bg-secondary/10 p-4">
        <div className="flex gap-4 overflow-x-auto h-full pb-4">
          {lists.map((list) => (
            <KanbanColumn
              key={list.id}
              list={list}
              tasks={tasksByList[list.id] || []}
              onAddTask={() => {}} // Disabled in public view
              onTaskClick={handleTaskClick}
              readOnly={true}
            />
          ))}
        </div>
      </div>

      {/* Read-only Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        boardId={board.id}
        workspaceId={board.workspace_id}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onTaskUpdated={() => {}}
        readOnly={true}
      />
    </div>
  );
}
