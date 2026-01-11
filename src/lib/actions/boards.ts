"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Board = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export async function getBoards(workspaceId: string): Promise<Board[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

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
