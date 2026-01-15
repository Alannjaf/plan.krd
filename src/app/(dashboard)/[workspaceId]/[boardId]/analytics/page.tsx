import { getWorkspace } from "@/lib/actions/workspaces";
import { getBoard } from "@/lib/actions/boards";
import { notFound } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface BoardAnalyticsPageProps {
  params: Promise<{ workspaceId: string; boardId: string }>;
}

export default async function BoardAnalyticsPage({ params }: BoardAnalyticsPageProps) {
  const { workspaceId, boardId } = await params;

  const [workspace, board] = await Promise.all([
    getWorkspace(workspaceId),
    getBoard(boardId),
  ]);

  if (!workspace || !board) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 pt-6 text-sm">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`/${workspaceId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {workspace.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`/${workspaceId}/${boardId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {board.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Analytics</span>
      </div>

      <AnalyticsDashboard workspaceId={workspaceId} boardId={boardId} />
    </div>
  );
}
