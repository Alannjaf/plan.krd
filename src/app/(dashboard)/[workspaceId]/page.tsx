import { getWorkspace } from "@/lib/actions/workspaces";
import { getBoards } from "@/lib/actions/boards";
import { notFound } from "next/navigation";
import { CreateBoardDialog } from "@/components/boards/create-board-dialog";
import { WorkspaceBoards } from "@/components/boards/workspace-boards";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    notFound();
  }

  const boards = await getBoards(workspaceId);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{workspace.name}</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
          {workspace.description && (
            <p className="text-muted-foreground mt-1">{workspace.description}</p>
          )}
        </div>
        <CreateBoardDialog workspaceId={workspaceId} />
      </div>

      <WorkspaceBoards workspaceId={workspaceId} initialBoards={boards} />
    </div>
  );
}
