import { getWorkspacesSummary } from "@/lib/actions/workspaces";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { WorkspaceCard } from "@/components/workspaces/workspace-card";
import { Folder } from "lucide-react";

export default async function DashboardPage() {
  const workspaces = await getWorkspacesSummary();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground mt-1">
            Manage your workspaces and collaborate with your team.
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border/50 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Folder className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            Create your first workspace to start organizing your tasks and
            collaborating with your team.
          </p>
          <CreateWorkspaceDialog />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}
    </div>
  );
}
