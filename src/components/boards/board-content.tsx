"use client";

import { useState, useEffect, useMemo, useTransition, useDeferredValue, lazy, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Loader2 } from "lucide-react";

// Lazy load views for code splitting (reduce initial bundle size)
const ListView = lazy(() => import("@/components/views/list-view").then(m => ({ default: m.ListView })));
const CalendarView = lazy(() => import("@/components/views/calendar-view").then(m => ({ default: m.CalendarView })));
const WorkloadView = lazy(() => import("@/components/views/workload-view").then(m => ({ default: m.WorkloadView })));

// Loading component for lazy-loaded views
const ViewLoadingFallback = () => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);
import { BoardHeaderActions } from "./board-header-actions";
import { InviteBoardMemberDialog } from "./invite-member-dialog";
import { ViewSwitcher, type ViewType } from "./view-switcher";
import { BoardFilter, type FilterState } from "./board-filter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive, Eye, EyeOff } from "lucide-react";
import { useRealtimeTasks } from "@/lib/hooks/use-realtime-tasks";
import type { List } from "@/lib/actions/lists";
import type { Board } from "@/lib/actions/boards";
import Link from "next/link";

interface BoardContentProps {
  workspace: { id: string; name: string };
  board: Board;
  lists: List[];
}

export function BoardContent({
  workspace,
  board,
  lists,
}: BoardContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>("kanban");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    assigneeId: null,
    labelId: null,
    priority: null,
    dueDateFrom: null,
    dueDateTo: null,
  });
  const [isPending, startTransition] = useTransition();

  // Subscribe to realtime updates for tasks
  const listIds = useMemo(() => lists.map((l) => l.id), [lists]);
  useRealtimeTasks(board.id, listIds);

  // Read task ID from URL param on mount
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) {
      setSelectedTaskId(taskParam);
      // Remove the param from URL without navigation
      router.replace(`/${workspace.id}/${board.id}`, { scroll: false });
    }
  }, [searchParams, workspace.id, board.id, router]);

  // Handle view changes with transition
  const handleViewChange = (view: ViewType) => {
    startTransition(() => {
      setCurrentView(view);
    });
  };

  // Handle filter changes with transition
  const handleFiltersChange = (newFilters: FilterState) => {
    startTransition(() => {
      setFilters(newFilters);
    });
  };

  const handleToggleArchived = () => {
    setShowArchived(!showArchived);
    // Each KanbanColumn will handle refetching with new showArchived value
  };

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
              onViewChange={handleViewChange}
            />
            <div className="w-px h-6 bg-border" />
            <BoardFilter
              boardId={board.id}
              workspaceId={workspace.id}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              onClick={handleToggleArchived}
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? (
                <>
                  <EyeOff className="h-3 w-3" />
                  Hide Archived
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3" />
                  Show Archived
                </>
              )}
            </Button>
            <InviteBoardMemberDialog boardId={board.id} />
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
            showArchived={showArchived}
          />
        )}
        {/* Note: List, Calendar, and Workload views still need full task data */}
        {/* These can be updated later to use per-list loading or a different strategy */}
        {currentView === "list" && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ListView
              tasks={[]}
              lists={lists}
              workspaceId={workspace.id}
              boardId={board.id}
            />
          </Suspense>
        )}
        {currentView === "calendar" && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <CalendarView
              tasks={[]}
              workspaceId={workspace.id}
              boardId={board.id}
            />
          </Suspense>
        )}
        {currentView === "workload" && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <WorkloadView
              tasks={[]}
              workspaceId={workspace.id}
              boardId={board.id}
            />
          </Suspense>
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
