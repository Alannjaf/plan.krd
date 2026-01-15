import { getWorkspace } from "@/lib/actions/workspaces";
import { notFound } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface WorkspaceAnalyticsPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceAnalyticsPage({ params }: WorkspaceAnalyticsPageProps) {
  const { workspaceId } = await params;
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
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
        <span className="font-medium">Analytics</span>
      </div>

      <AnalyticsDashboard workspaceId={workspaceId} />
    </div>
  );
}
