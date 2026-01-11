import { getWorkspace, getWorkspaceMembers } from "@/lib/actions/workspaces";
import { getPendingInvitations } from "@/lib/actions/invitations";
import { getUser } from "@/lib/auth/actions";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteMemberDialog } from "@/components/workspaces/invite-member-dialog";
import { MembersList } from "@/components/workspaces/members-list";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [workspace, user] = await Promise.all([
    getWorkspace(workspaceId),
    getUser(),
  ]);

  if (!workspace) {
    notFound();
  }

  if (!user) {
    redirect("/auth/sign-in");
  }

  const [members, pendingInvitations] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    getPendingInvitations(workspaceId),
  ]);

  const isOwner = workspace.owner_id === user.id;
  const currentMember = members.find((m) => m.user_id === user.id);
  const isAdmin = currentMember?.role === "admin" || isOwner;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/${workspaceId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workspace
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{workspace.name} Settings</h1>
            <p className="text-muted-foreground">
              Manage workspace settings and team members
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Workspace Details */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace Details</CardTitle>
            <CardDescription>
              Basic information about this workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Workspace Name</Label>
              <Input value={workspace.name} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={workspace.description || "No description"} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Created</Label>
              <Input
                value={new Date(workspace.created_at).toLocaleDateString()}
                disabled
              />
            </div>
          </CardContent>
        </Card>

        {/* Team Members Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""}
              {pendingInvitations.length > 0 &&
                ` • ${pendingInvitations.length} pending`}
            </p>
          </div>
          {isAdmin && <InviteMemberDialog workspaceId={workspaceId} />}
        </div>

        <MembersList
          members={members}
          pendingInvitations={pendingInvitations}
          workspaceId={workspaceId}
          currentUserId={user.id}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
