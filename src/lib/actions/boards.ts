"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Board = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  position: number;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  public_token: string | null;
  public_enabled: boolean;
};

export async function getBoards(workspaceId: string, includeArchived: boolean = false): Promise<Board[]> {
  const supabase = await createClient();

  let query = supabase
    .from("boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching boards:", error);
    return [];
  }

  return data || [];
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .single();

  if (error) {
    console.error("Error fetching board:", error);
    return null;
  }

  return data;
}

export async function createBoard(
  workspaceId: string,
  name: string,
  description?: string
): Promise<{ success: boolean; board?: Board; error?: string }> {
  const supabase = await createClient();

  // Get the highest position
  const { data: lastBoard } = await supabase
    .from("boards")
    .select("position")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastBoard?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("boards")
    .insert({
      workspace_id: workspaceId,
      name,
      description: description || null,
      position,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating board:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${workspaceId}`);
  return { success: true, board: data };
}

export async function updateBoard(
  boardId: string,
  updates: { name?: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const { error } = await supabase
    .from("boards")
    .update(updates)
    .eq("id", boardId);

  if (error) {
    console.error("Error updating board:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${board.workspace_id}`);
  revalidatePath(`/${board.workspace_id}/${boardId}`);
  return { success: true };
}

export async function deleteBoard(
  boardId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const { error } = await supabase.from("boards").delete().eq("id", boardId);

  if (error) {
    console.error("Error deleting board:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${board.workspace_id}`);
  return { success: true };
}

export async function archiveBoard(
  boardId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const { error } = await supabase
    .from("boards")
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq("id", boardId);

  if (error) {
    console.error("Error archiving board:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${board.workspace_id}`);
  return { success: true };
}

export async function unarchiveBoard(
  boardId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const { error } = await supabase
    .from("boards")
    .update({ archived: false, archived_at: null })
    .eq("id", boardId);

  if (error) {
    console.error("Error unarchiving board:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${board.workspace_id}`);
  return { success: true };
}

/**
 * Generate a public token for a board to enable public read-only access
 */
export async function generatePublicToken(
  boardId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = await createClient();

  // Verify board exists and user has access
  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  // Generate a new UUID token
  const publicToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from("boards")
    .update({
      public_token: publicToken,
      public_enabled: true,
    })
    .eq("id", boardId)
    .select("public_token")
    .single();

  if (error) {
    console.error("Error generating public token:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${board.workspace_id}/${boardId}`);
  return { success: true, token: data.public_token };
}

/**
 * Revoke public access by removing the public token
 */
export async function revokePublicToken(
  boardId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify board exists and user has access
  const { data: board, error: fetchError } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const { error } = await supabase
    .from("boards")
    .update({
      public_token: null,
      public_enabled: false,
    })
    .eq("id", boardId);

  if (error) {
    console.error("Error revoking public token:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${board.workspace_id}/${boardId}`);
  return { success: true };
}

/**
 * Fetch a board by its public token (for public read-only access)
 */
export async function getPublicBoard(
  token: string
): Promise<{ success: boolean; board?: Board; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("public_token", token)
    .eq("public_enabled", true)
    .single();

  if (error) {
    console.error("Error fetching public board:", error);
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false, error: "Board not found or public access is disabled" };
  }

  return { success: true, board: data };
}

/**
 * Check if a board has public access enabled
 */
export async function isPublicBoard(
  boardId: string
): Promise<{ success: boolean; isPublic?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("boards")
    .select("public_enabled, public_token")
    .eq("id", boardId)
    .single();

  if (error) {
    console.error("Error checking public board status:", error);
    return { success: false, error: error.message };
  }

  const isPublic = data.public_enabled && data.public_token !== null;

  return { success: true, isPublic };
}
