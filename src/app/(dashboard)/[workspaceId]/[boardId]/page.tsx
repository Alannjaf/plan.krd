import { getWorkspace } from "@/lib/actions/workspaces";
import { getBoard } from "@/lib/actions/boards";
import { getLists } from "@/lib/actions/lists";
import { getTasksWithRelations } from "@/lib/actions/tasks";
import { notFound } from "next/navigation";
import { BoardContent } from "@/components/boards/board-content";

interface BoardPageProps {
  params: Promise<{ workspaceId: string; boardId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { workspaceId, boardId } = await params;

  const [workspace, board, lists, tasks] = await Promise.all([
    getWorkspace(workspaceId),
    getBoard(boardId),
    getLists(boardId),
    getTasksWithRelations(boardId),
  ]);

  if (!workspace || !board) {
    notFound();
  }

  return (
    <BoardContent
      workspace={{ id: workspace.id, name: workspace.name }}
      board={board}
      lists={lists}
      initialTasks={tasks}
    />
  );
}
