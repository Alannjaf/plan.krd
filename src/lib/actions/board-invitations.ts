"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";

export type BoardInvitation = {
  id: string;
  board_id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member" | "viewer" | "commenter";
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

/**
 * Verify user has access to workspace
 */
async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

/**
 * Verify user has access to board (workspace member)
 */
async function verifyBoardAccess(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Get board to check workspace
  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (!board) {
    return false;
  }

  // Check workspace access
  return await verifyWorkspaceAccess(board.workspace_id, userId);
}

export async function inviteBoardMember(
  boardId: string,
  email: string,
  role: "admin" | "member" | "viewer" | "commenter" = "member"
): Promise<{ success: boolean; invitation?: BoardInvitation; inviteUrl?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify user has access to board
  const hasAccess = await verifyBoardAccess(boardId, user.id);
  if (!hasAccess) {
    return { success: false, error: "You don't have access to this board" };
  }

  // Get board to get workspace_id
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return { success: false, error: "Board not found" };
  }

  // Check if user is already a board member
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (profile) {
    const { data: existingMember } = await supabase
      .from("board_members")
      .select("id")
      .eq("board_id", boardId)
      .eq("user_id", profile.id)
      .single();

    if (existingMember) {
      return { success: false, error: "User is already a member of this board" };
    }
  }

  // Check if there's already a pending invitation
  const { data: existingInvitation } = await supabase
    .from("board_invitations")
    .select("id")
    .eq("board_id", boardId)
    .eq("email", email)
    .is("accepted_at", null)
    .single();

  if (existingInvitation) {
    return { success: false, error: "An invitation has already been sent to this email" };
  }

  // Generate token
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  const { data, error } = await supabase
    .from("board_invitations")
    .insert({
      board_id: boardId,
      workspace_id: board.workspace_id,
      email,
      role,
      invited_by: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating board invitation", error, { boardId, email, role, invitedBy: user.id });
    return { success: false, error: error.message };
  }

  const inviteUrl = `/invite/board/${data.token}`;

  revalidatePath(`/${board.workspace_id}/${boardId}`);
  return { success: true, invitation: data, inviteUrl };
}

export async function acceptBoardInvitation(
  token: string
): Promise<{ success: boolean; boardId?: string; workspaceId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the invitation
  const { data: invitation, error: fetchError } = await supabase
    .from("board_invitations")
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

  // Ensure user is a workspace member (add if not)
  const { data: existingWorkspaceMember } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invitation.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!existingWorkspaceMember) {
    // Add user to workspace as viewer (lowest permission)
    const { error: workspaceMemberError } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: "viewer",
      });

    if (workspaceMemberError && workspaceMemberError.code !== "23505") {
      // Ignore unique violation (already a member)
      logger.error("Error adding workspace member", workspaceMemberError, {
        workspaceId: invitation.workspace_id,
        userId: user.id,
      });
      return { success: false, error: workspaceMemberError.message };
    }
  }

  // Add user to board_members
  const { error: memberError } = await supabase.from("board_members").insert({
    board_id: invitation.board_id,
    user_id: user.id,
    role: invitation.role,
  });

  if (memberError) {
    // User might already be a member
    if (memberError.code === "23505") {
      // Unique violation
      return { success: false, error: "You are already a member of this board" };
    }
    logger.error("Error adding board member", memberError, {
      boardId: invitation.board_id,
      userId: user.id,
      role: invitation.role,
    });
    return { success: false, error: memberError.message };
  }

  // Mark invitation as accepted
  const { error: updateError } = await supabase
    .from("board_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  if (updateError) {
    logger.error("Error updating invitation", updateError, { invitationId: invitation.id });
  }

  revalidatePath(`/${invitation.workspace_id}/${invitation.board_id}`);
  return { success: true, boardId: invitation.board_id, workspaceId: invitation.workspace_id };
}

export async function getBoardInvitationByToken(
  token: string
): Promise<{ invitation: BoardInvitation | null; board: { name: string } | null; workspace: { name: string } | null }> {
  const supabase = await createClient();

  const { data: invitation, error } = await supabase
    .from("board_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error || !invitation) {
    logger.error("Error fetching board invitation by token", error, { token });
    return { invitation: null, board: null, workspace: null };
  }

  // Get board and workspace separately
  const [boardResult, workspaceResult] = await Promise.all([
    supabase.from("boards").select("name").eq("id", invitation.board_id).single(),
    supabase.from("workspaces").select("name").eq("id", invitation.workspace_id).single(),
  ]);

  if (boardResult.error || !boardResult.data || workspaceResult.error || !workspaceResult.data) {
    logger.error("Board or workspace not found for invitation", undefined, {
      token,
      invitationId: invitation.id,
      boardError: boardResult.error,
      workspaceError: workspaceResult.error,
    });
    return { invitation: null, board: null, workspace: null };
  }

  return {
    invitation: {
      id: invitation.id,
      board_id: invitation.board_id,
      workspace_id: invitation.workspace_id,
      email: invitation.email,
      role: invitation.role,
      invited_by: invitation.invited_by,
      token: invitation.token,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
      created_at: invitation.created_at,
    },
    board: { name: boardResult.data.name },
    workspace: { name: workspaceResult.data.name },
  };
}

export async function getBoardMembers(boardId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("board_members")
    .select(
      `
      id,
      user_id,
      role,
      joined_at,
      profiles:profiles!board_members_user_id_fkey(id, email, full_name, avatar_url)
    `
    )
    .eq("board_id", boardId)
    .order("joined_at", { ascending: true });

  if (error) {
    logger.error("Error fetching board members", error, { boardId });
    return [];
  }

  return data || [];
}
