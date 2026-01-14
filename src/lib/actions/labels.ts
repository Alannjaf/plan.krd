"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";

export type Label = {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
};

export async function getLabels(boardId: string): Promise<Label[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("labels")
    .select("*")
    .eq("board_id", boardId)
    .order("name", { ascending: true });

  if (error) {
    logger.error("Error fetching labels", error, { boardId });
    return [];
  }

  return data || [];
}

export async function createLabel(
  boardId: string,
  name: string,
  color: string
): Promise<{ success: boolean; label?: Label; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("labels")
    .insert({ board_id: boardId, name, color })
    .select()
    .single();

  if (error) {
    logger.error("Error creating label", error, { boardId, name, color });
    return { success: false, error: error.message };
  }

  return { success: true, label: data };
}

export async function updateLabel(
  labelId: string,
  updates: { name?: string; color?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("labels")
    .update(updates)
    .eq("id", labelId);

  if (error) {
    console.error("Error updating label:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteLabel(
  labelId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("labels").delete().eq("id", labelId);

  if (error) {
    logger.error("Error deleting label", error, { labelId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getTaskLabels(taskId: string): Promise<Label[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_labels")
    .select("label_id, labels(*)")
    .eq("task_id", taskId);

  if (error) {
    logger.error("Error fetching task labels", error, { taskId });
    return [];
  }

  return data?.map((tl) => tl.labels as unknown as Label) || [];
}

export async function addLabelToTask(
  taskId: string,
  labelId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_labels")
    .insert({ task_id: taskId, label_id: labelId });

  if (error) {
    console.error("Error adding label to task:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function removeLabelFromTask(
  taskId: string,
  labelId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_labels")
    .delete()
    .eq("task_id", taskId)
    .eq("label_id", labelId);

  if (error) {
    logger.error("Error removing label from task", error, { taskId, labelId });
    return { success: false, error: error.message };
  }

  return { success: true };
}
