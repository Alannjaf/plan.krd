"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ListView } from "@/components/views/list-view";
import { CalendarView } from "@/components/views/calendar-view";
import { WorkloadView } from "@/components/views/workload-view";
import { BoardHeaderActions } from "./board-header-actions";
import { ViewSwitcher, type ViewType } from "./view-switcher";
import { BoardFilter, filterTasks, type FilterState } from "./board-filter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, Eye, EyeOff } from "lucide-react";
import { getTasksWithRelations, type TaskWithRelations } from "@/lib/actions/tasks";
import type { List } from "@/lib/actions/lists";
import type { Board } from "@/lib/actions/boards";
import Link from "next/link";

interface BoardContentProps {
  workspace: { id: string; name: string };
  board: Board;
  lists: List[];
  initialTasks: TaskWithRelations[];
}

export function BoardContent({
  workspace,
  board,
  lists,
  initialTasks,
}: BoardContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>("kanban");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    assigneeId: null,
    labelId: null,
    priority: null,
    dueDateFrom: null,
    dueDateTo: null,
  });

  // Read task ID from URL param on mount
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) {
      setSelectedTaskId(taskParam);
      // Remove the param from URL without navigation
      router.replace(`/${workspace.id}/${board.id}`, { scroll: false });
    }
  }, [searchParams, workspace.id, board.id, router]);

  // Apply filters to tasks
  const filteredTasks = filterTasks(tasks, filters);

  const handleToggleArchived = async () => {
    setIsLoading(true);
    const newShowArchived = !showArchived;
    setShowArchived(newShowArchived);
    
    // Refetch tasks with the new filter
    const newTasks = await getTasksWithRelations(board.id, newShowArchived);
    setTasks(newTasks);
    setIsLoading(false);
  };

  // Count archived tasks for display
  const archivedCount = showArchived
    ? tasks.filter((t) => t.archived).length
    : 0;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Board Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${workspace.id}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{workspace.name}</span>
              <span>/</span>
            </div>
            <h1 className="font-semibold">{board.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ViewSwitcher
              currentView={currentView}
              onViewChange={setCurrentView}
            />
            <div className="w-px h-6 bg-border" />
            <BoardFilter
              boardId={board.id}
              workspaceId={workspace.id}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              onClick={handleToggleArchived}
              disabled={isLoading}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  Hide Archived
                  {archivedCount > 0 && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {archivedCount}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Show Archived
                </>
              )}
            </Button>
            <BoardHeaderActions board={board} workspaceId={workspace.id} />
          </div>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-hidden bg-secondary/10 p-4">
        {currentView === "kanban" && (
          <KanbanBoard
            boardId={board.id}
            workspaceId={workspace.id}
            lists={lists}
            tasks={filteredTasks}
            showArchived={showArchived}
          />
        )}
        {currentView === "list" && (
          <ListView
            tasks={filteredTasks}
            lists={lists}
            workspaceId={workspace.id}
            boardId={board.id}
          />
        )}
        {currentView === "calendar" && (
          <CalendarView
            tasks={filteredTasks}
            workspaceId={workspace.id}
            boardId={board.id}
          />
        )}
        {currentView === "workload" && (
          <WorkloadView
            tasks={filteredTasks}
            workspaceId={workspace.id}
            boardId={board.id}
          />
        )}
      </div>

      {/* Task Detail Modal for URL param */}
      <TaskDetailModal
        taskId={selectedTaskId}
        boardId={board.id}
        workspaceId={workspace.id}
        open={!!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
          }
        }}
        onTaskUpdated={() => {}}
      />
    </div>
  );
}
