import { getWorkspace } from "@/lib/actions/workspaces";
import { getBoard } from "@/lib/actions/boards";
import { getLists } from "@/lib/actions/lists";
import { notFound } from "next/navigation";
import { BoardContent } from "@/components/boards/board-content";
import { Suspense } from "react";

interface BoardPageProps {
  params: Promise<{ workspaceId: string; boardId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { workspaceId, boardId } = await params;

  // Only fetch board metadata, workspace, and lists on initial load
  // Tasks will be loaded per-list by each KanbanColumn component
  const [workspace, board, lists] = await Promise.all([
    getWorkspace(workspaceId),
    getBoard(boardId),
    getLists(boardId),
  ]);

  if (!workspace || !board) {
    notFound();
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BoardContent
        workspace={{ id: workspace.id, name: workspace.name }}
        board={board}
        lists={lists}
      />
    </Suspense>
  );
}
