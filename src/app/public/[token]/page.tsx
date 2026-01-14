import { getPublicBoard } from "@/lib/actions/boards";
import { getLists } from "@/lib/actions/lists";
import { getTasksWithRelations } from "@/lib/actions/tasks";
import { notFound } from "next/navigation";
import { PublicBoardView } from "@/components/boards/public-board-view";
import { Suspense } from "react";

interface PublicBoardPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicBoardPage({ params }: PublicBoardPageProps) {
  const { token } = await params;

  // Fetch board by public token
  const { success, board, error } = await getPublicBoard(token);

  if (!success || !board) {
    notFound();
  }

  // Fetch lists and tasks for the board
  const [lists, tasksResult] = await Promise.all([
    getLists(board.id),
    getTasksWithRelations(board.id),
  ]);

  // Handle both array and paginated result for backward compatibility
  const tasks = Array.isArray(tasksResult) ? tasksResult : tasksResult.tasks;

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <PublicBoardView
        board={board}
        lists={lists}
        tasks={tasks}
      />
    </Suspense>
  );
}
