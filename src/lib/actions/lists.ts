"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";

export type List = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
};

export async function getLists(boardId: string): Promise<List[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching lists:", error);
    return [];
  }

  return data || [];
}

export async function createList(
  boardId: string,
  name: string
): Promise<{ success: boolean; list?: List; error?: string }> {
  const supabase = await createClient();

  // Get the highest position
  const { data: lastList } = await supabase
    .from("lists")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastList?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("lists")
    .insert({
      board_id: boardId,
      name,
      position,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating list", error, { boardId, name });
    return { success: false, error: error.message };
  }

  // Get board for revalidation
  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (board) {
    revalidatePath(`/${board.workspace_id}/${boardId}`);
  }

  return { success: true, list: data };
}

export async function updateList(
  listId: string,
  updates: { name?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lists")
    .update(updates)
    .eq("id", listId);

  if (error) {
    console.error("Error updating list:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteList(
  listId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("lists").delete().eq("id", listId);

  if (error) {
    logger.error("Error deleting list", error, { listId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function reorderLists(
  boardId: string,
  listIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Update positions in batch
  const updates = listIds.map((id, index) => ({
    id,
    position: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("lists")
      .update({ position: update.position })
      .eq("id", update.id);

    if (error) {
      logger.error("Error reordering lists", error, { boardId, listIdsCount: listIds.length });
      return { success: false, error: error.message };
    }
  }

  // Get board for revalidation
  const { data: board } = await supabase
    .from("boards")
    .select("workspace_id")
    .eq("id", boardId)
    .single();

  if (board) {
    revalidatePath(`/${board.workspace_id}/${boardId}`);
  }

  return { success: true };
}
