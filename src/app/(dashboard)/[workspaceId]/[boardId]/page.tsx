import { getWorkspace } from "@/lib/actions/workspaces";
import { getBoard } from "@/lib/actions/boards";
import { getLists } from "@/lib/actions/lists";
import { getTasksByBoard } from "@/lib/actions/tasks";
import { notFound } from "next/navigation";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { BoardHeaderActions } from "@/components/boards/board-header-actions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BoardPageProps {
  params: Promise<{ workspaceId: string; boardId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { workspaceId, boardId } = await params;

  const [workspace, board, lists, tasks] = await Promise.all([
    getWorkspace(workspaceId),
    getBoard(boardId),
    getLists(boardId),
    getTasksByBoard(boardId),
  ]);

  if (!workspace || !board) {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Board Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${workspaceId}`}
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
          <BoardHeaderActions board={board} workspaceId={workspaceId} />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden bg-secondary/10 p-4">
        <KanbanBoard boardId={boardId} lists={lists} tasks={tasks} />
      </div>
    </div>
  );
}
