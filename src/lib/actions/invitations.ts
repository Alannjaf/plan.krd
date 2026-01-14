"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";

export type WorkspaceInvitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: "admin" | "member" | "viewer" = "member"
): Promise<{ success: boolean; invitation?: WorkspaceInvitation; inviteUrl?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", (
      await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single()
    ).data?.id)
    .single();

  if (existingMember) {
    return { success: false, error: "User is already a member of this workspace" };
  }

  // Check if there's already a pending invitation
  const { data: existingInvitation } = await supabase
    .from("workspace_invitations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .is("accepted_at", null)
    .single();

  if (existingInvitation) {
    return { success: false, error: "An invitation has already been sent to this email" };
  }

  const { data, error } = await supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: workspaceId,
      email,
      role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating invitation", error, { workspaceId, email, role, invitedBy: user.id });
    return { success: false, error: error.message };
  }

  const inviteUrl = `/invite/${data.token}`;

  revalidatePath(`/${workspaceId}/settings`);
  return { success: true, invitation: data, inviteUrl };
}

export async function acceptInvitation(
  token: string
): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the invitation
  const { data: invitation, error: fetchError } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (fetchError || !invitation) {
    return { success: false, error: "Invalid or expired invitation" };
  }

  // Check if invitation is expired
  if (new Date(invitation.expires_at) < new Date()) {
    return { success: false, error: "This invitation has expired" };
  }

  // Check if email matches
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { success: false, error: "This invitation was sent to a different email address" };
  }

  // Add user to workspace_members
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: invitation.workspace_id,
      user_id: user.id,
      role: invitation.role,
    });

  if (memberError) {
    // User might already be a member
    if (memberError.code === "23505") {
      // Unique violation
      return { success: false, error: "You are already a member of this workspace" };
    }
    logger.error("Error adding member", memberError, { workspaceId: invitation.workspace_id, userId: user.id, role: invitation.role });
    return { success: false, error: memberError.message };
  }

  // Mark invitation as accepted
  const { error: updateError } = await supabase
    .from("workspace_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  if (updateError) {
    logger.error("Error updating invitation", updateError, { invitationId: invitation.id });
  }

  revalidatePath(`/${invitation.workspace_id}`);
  return { success: true, workspaceId: invitation.workspace_id };
}

export async function revokeInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    logger.error("Error revoking invitation", error, { invitationId });
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function getPendingInvitations(
  workspaceId: string
): Promise<WorkspaceInvitation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invitations:", error);
    return [];
  }

  return data || [];
}

export async function getInvitationByToken(
  token: string
): Promise<{ invitation: WorkspaceInvitation | null; workspace: { name: string } | null }> {
  const supabase = await createClient();

  const { data: invitation, error } = await supabase
    .from("workspace_invitations")
    .select("*, workspaces(name)")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error || !invitation) {
    logger.error("Error fetching invitation by token", error, { token });
    return { invitation: null, workspace: null };
  }

  const workspace = (invitation as { workspaces: { name: string } | null }).workspaces;

  // If workspace is null (RLS issue or deleted workspace), return null
  if (!workspace) {
    logger.error("Workspace not found for invitation", undefined, { token, invitationId: invitation.id });
    return { invitation: null, workspace: null };
  }

  return {
    invitation: {
      id: invitation.id,
      workspace_id: invitation.workspace_id,
      email: invitation.email,
      role: invitation.role,
      invited_by: invitation.invited_by,
      token: invitation.token,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
      created_at: invitation.created_at,
    },
    workspace: { name: workspace.name },
  };
}
