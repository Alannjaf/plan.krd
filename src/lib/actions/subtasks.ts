"use server";

import { createClient } from "@/lib/supabase/server";

export type Subtask = {
  id: string;
  parent_task_id: string;
  title: string;
  completed: boolean;
  position: number;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at?: string;
  assignee?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function getSubtasks(taskId: string): Promise<Subtask[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subtasks")
    .select(`
      *,
      assignee:profiles!subtasks_assignee_id_fkey(id, email, full_name, avatar_url)
    `)
    .eq("parent_task_id", taskId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching subtasks:", error);
    return [];
  }

  return data || [];
}

export async function createSubtask(
  taskId: string,
  title: string,
  dueDate?: string | null,
  assigneeId?: string | null
): Promise<{ success: boolean; subtask?: Subtask; error?: string }> {
  const supabase = await createClient();

  // Get max position
  const { data: existing } = await supabase
    .from("subtasks")
    .select("position")
    .eq("parent_task_id", taskId)
    .order("position", { ascending: false })
    .limit(1);

  const position = existing && existing.length > 0 ? existing[0].position + 1 : 0;

  const insertData: {
    parent_task_id: string;
    title: string;
    position: number;
    due_date?: string | null;
    assignee_id?: string | null;
  } = {
    parent_task_id: taskId,
    title,
    position,
  };

  if (dueDate !== undefined) {
    insertData.due_date = dueDate;
  }

  if (assigneeId !== undefined) {
    insertData.assignee_id = assigneeId;
  }

  const { data, error } = await supabase
    .from("subtasks")
    .insert(insertData)
    .select(`
      *,
      assignee:profiles!subtasks_assignee_id_fkey(id, email, full_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error("Error creating subtask:", error);
    return { success: false, error: error.message };
  }

  return { success: true, subtask: data };
}

export async function updateSubtask(
  subtaskId: string,
  updates: {
    title?: string;
    completed?: boolean;
    due_date?: string | null;
    assignee_id?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("subtasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", subtaskId);

  if (error) {
    console.error("Error updating subtask:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteSubtask(
  subtaskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);

  if (error) {
    console.error("Error deleting subtask:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function toggleSubtask(
  subtaskId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  return updateSubtask(subtaskId, { completed });
}

export async function reorderSubtasks(
  taskId: string,
  subtaskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Update positions for all subtasks
  const updates = subtaskIds.map((id, index) =>
    supabase.from("subtasks").update({ position: index }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const error = results.find((r) => r.error);

  if (error?.error) {
    console.error("Error reordering subtasks:", error.error);
    return { success: false, error: error.error.message };
  }

  return { success: true };
}
