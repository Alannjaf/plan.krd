"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Task = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: "low" | "medium" | "high" | "urgent" | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function getTasks(listId: string): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("list_id", listId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return data || [];
}

export async function getTasksByBoard(boardId: string): Promise<Task[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*, lists!inner(board_id)")
    .eq("lists.board_id", boardId)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  return data || [];
}

export async function createTask(
  listId: string,
  title: string,
  options?: {
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    due_date?: string;
  }
): Promise<{ success: boolean; task?: Task; error?: string }> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get the highest position in this list
  const { data: lastTask } = await supabase
    .from("tasks")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastTask?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      list_id: listId,
      title,
      description: options?.description || null,
      priority: options?.priority || null,
      due_date: options?.due_date || null,
      position,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    return { success: false, error: error.message };
  }

  return { success: true, task: data };
}

export async function updateTask(
  taskId: string,
  updates: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high" | "urgent" | null;
    due_date?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId);

  if (error) {
    console.error("Error updating task:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    console.error("Error deleting task:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function moveTask(
  taskId: string,
  targetListId: string,
  newPosition: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get the current task
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("list_id, position")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return { success: false, error: fetchError?.message || "Task not found" };
  }

  const sourceListId = task.list_id;
  const oldPosition = task.position;

  // If moving within the same list
  if (sourceListId === targetListId) {
    if (oldPosition === newPosition) {
      return { success: true };
    }

    // Get all tasks in this list
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, position")
      .eq("list_id", targetListId)
      .order("position", { ascending: true });

    if (!tasks) {
      return { success: false, error: "Failed to fetch tasks" };
    }

    // Calculate new positions
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    updatedTasks.splice(newPosition, 0, { id: taskId, position: newPosition });

    // Update all positions
    for (let i = 0; i < updatedTasks.length; i++) {
      await supabase
        .from("tasks")
        .update({ position: i })
        .eq("id", updatedTasks[i].id);
    }
  } else {
    // Moving to a different list
    // Update positions in source list (shift down)
    await supabase.rpc("decrement_positions_after", {
      p_list_id: sourceListId,
      p_position: oldPosition,
    });

    // Get tasks in target list to make room
    const { data: targetTasks } = await supabase
      .from("tasks")
      .select("id, position")
      .eq("list_id", targetListId)
      .gte("position", newPosition)
      .order("position", { ascending: false });

    // Shift positions in target list
    if (targetTasks) {
      for (const t of targetTasks) {
        await supabase
          .from("tasks")
          .update({ position: t.position + 1 })
          .eq("id", t.id);
      }
    }

    // Move the task
    const { error } = await supabase
      .from("tasks")
      .update({ list_id: targetListId, position: newPosition })
      .eq("id", taskId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

export async function reorderTasksInList(
  listId: string,
  taskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  for (let i = 0; i < taskIds.length; i++) {
    const { error } = await supabase
      .from("tasks")
      .update({ position: i, list_id: listId })
      .eq("id", taskIds[i]);

    if (error) {
      console.error("Error reordering tasks:", error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}
