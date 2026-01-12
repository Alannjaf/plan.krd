"use client";

import { usePrefetchWorkspaceMembers } from "@/lib/query/queries/members";
import { useParams } from "next/navigation";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // Pre-fetch workspace members when entering workspace
  // This ensures members are cached before opening task modals
  usePrefetchWorkspaceMembers(workspaceId);

  return <>{children}</>;
}
