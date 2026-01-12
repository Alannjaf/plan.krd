"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activities";

export type Task = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: "low" | "medium" | "high" | "urgent" | null;
  start_date: string | null;
  due_date: string | null;
  archived: boolean;
  archived_at: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomFieldValue = {
  id: string;
  field_id: string;
  value: string | null;
  custom_field: {
    id: string;
    name: string;
    field_type: "text" | "number" | "dropdown";
    options: string[];
    required: boolean;
    position: number;
  };
};

export type TaskWithRelations = Task & {
  assignees: Array<{
    id: string;
    user_id: string;
    profiles: {
      id: string;
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
    };
  }>;
  labels: Array<{
    id: string;
    label_id: string;
    labels: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    position: number;
    due_date: string | null;
    assignee_id: string | null;
    assignee?: {
      id: string;
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
  custom_field_values: CustomFieldValue[];
  attachments_count: number;
  comments_count: number;
};

export async function getTask(taskId: string, boardId?: string): Promise<TaskWithRelations | null> {
  // Skip database query if taskId is a temporary ID (optimistic update)
  if (taskId.startsWith("temp-")) {
    return null;
  }

  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignees:task_assignees(
        id,
        user_id,
        profiles:profiles!task_assignees_user_id_fkey(id, email, full_name, avatar_url)
      ),
      labels:task_labels(
        id,
        label_id,
        labels(id, name, color)
      ),
      subtasks(id, title, completed, position, due_date, assignee_id, assignee:profiles!subtasks_assignee_id_fkey(id, email, full_name, avatar_url)),
      custom_field_values(
        id,
        field_id,
        value,
        custom_field:custom_fields(id, name, field_type, options, required, position)
      )
    `)
    .eq("id", taskId)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    return null;
  }

  // Get counts for attachments and comments in parallel
  // Only query if we have a valid UUID (not temp ID)
  const [{ count: attachments_count }, { count: comments_count }] = await Promise.all([
    supabase
      .from("attachments")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("task_id", taskId),
  ]);

  // Sort custom field values by field position
  const sortedCustomFieldValues = (task.custom_field_values || [])
    .filter((cfv: { custom_field: { position: number } | null }) => cfv.custom_field)
    .sort((a: { custom_field: { position: number } }, b: { custom_field: { position: number } }) => 
      a.custom_field.position - b.custom_field.position
    );

  return {
    ...task,
    custom_field_values: sortedCustomFieldValues,
    attachments_count: attachments_count || 0,
    comments_count: comments_count || 0,
  } as TaskWithRelations;
}

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

export async function getTasksWithRelations(boardId: string, includeArchived = false): Promise<TaskWithRelations[]> {
  const supabase = await createClient();

  // Get all tasks with relations in a single query using nested selects
  let query = supabase
    .from("tasks")
    .select(`
      *,
      lists!inner(board_id),
      assignees:task_assignees(
        id,
        user_id,
        profiles:profiles!task_assignees_user_id_fkey(id, email, full_name, avatar_url)
      ),
      labels:task_labels(
        id,
        label_id,
        labels(id, name, color)
      ),
      subtasks(
        id,
        title,
        completed,
        position,
        due_date,
        assignee_id,
        assignee:profiles!subtasks_assignee_id_fkey(id, email, full_name, avatar_url)
      )
    `)
    .eq("lists.board_id", boardId)
    .order("position", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data: tasks, error: tasksError } = await query;

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    return [];
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  const taskIds = tasks.map((t) => t.id);

  // Fetch counts in parallel (these can't be nested efficiently)
  const [attachmentsResult, commentsResult] = await Promise.all([
    supabase
      .from("attachments")
      .select("task_id")
      .in("task_id", taskIds),
    supabase
      .from("comments")
      .select("task_id")
      .in("task_id", taskIds),
  ]);

  // Count attachments and comments by task_id
  const attachmentsCountByTask = new Map<string, number>();
  const commentsCountByTask = new Map<string, number>();

  attachmentsResult.data?.forEach((a) => {
    const count = attachmentsCountByTask.get(a.task_id) || 0;
    attachmentsCountByTask.set(a.task_id, count + 1);
  });

  commentsResult.data?.forEach((c) => {
    const count = commentsCountByTask.get(c.task_id) || 0;
    commentsCountByTask.set(c.task_id, count + 1);
  });

  // Combine tasks with their relations
  return tasks.map((task: any) => ({
    ...task,
    assignees: (task.assignees || []).map((a: any) => ({
      id: a.id,
      user_id: a.user_id,
      profiles: a.profiles as {
        id: string;
        email: string | null;
        full_name: string | null;
        avatar_url: string | null;
      },
    })),
    labels: (task.labels || []).map((l: any) => ({
      id: l.id,
      label_id: l.label_id,
      labels: l.labels as {
        id: string;
        name: string;
        color: string;
      },
    })),
    subtasks: (task.subtasks || []).sort((a: any, b: any) => a.position - b.position).map((s: any) => ({
      id: s.id,
      title: s.title,
      completed: s.completed,
      position: s.position,
      due_date: s.due_date,
      assignee_id: s.assignee_id,
      assignee: s.assignee as {
        id: string;
        email: string | null;
        full_name: string | null;
        avatar_url: string | null;
      } | null,
    })),
    custom_field_values: [],
    attachments_count: attachmentsCountByTask.get(task.id) || 0,
    comments_count: commentsCountByTask.get(task.id) || 0,
  })) as TaskWithRelations[];
}

export async function createTask(
  listId: string,
  title: string,
  options?: {
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    start_date?: string;
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
      start_date: options?.start_date || null,
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

  // Log activity
  await logActivity(data.id, "created", { title });

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true, task: data };
}

export async function updateTask(
  taskId: string,
  updates: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high" | "urgent" | null;
    start_date?: string | null;
    due_date?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  // Skip database operation if taskId is a temporary ID (optimistic update)
  if (taskId.startsWith("temp-")) {
    return { success: false, error: "Cannot update task with temporary ID. Please wait for task to be created." };
  }

  const supabase = await createClient();

  // Get current task for activity logging
  const { data: currentTask } = await supabase
    .from("tasks")
    .select("title, description, priority, start_date, due_date, list_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    console.error("Error updating task:", error);
    return { success: false, error: error.message };
  }

  // Log activities for changes
  if (currentTask) {
    if (updates.priority !== undefined && updates.priority !== currentTask.priority) {
      await logActivity(taskId, "priority_changed", {
        from: currentTask.priority,
        to: updates.priority,
      });
    }
    if (updates.due_date !== undefined && updates.due_date !== currentTask.due_date) {
      await logActivity(taskId, "due_date_changed", {
        from: currentTask.due_date,
        to: updates.due_date,
      });
    }
    if (updates.description !== undefined && updates.description !== currentTask.description) {
      await logActivity(taskId, "description_changed", {});
    }
  }

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}

export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get board info before deleting
  const { data: task } = await supabase
    .from("tasks")
    .select("list_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    console.error("Error deleting task:", error);
    return { success: false, error: error.message };
  }

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

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

    // Note: No revalidatePath needed - React Query handles cache invalidation
    // and realtime subscriptions handle live updates
  } else {
    // Moving to a different list
    // Get list names for activity log
    const [{ data: sourceList }, { data: targetList }] = await Promise.all([
      supabase.from("lists").select("name").eq("id", sourceListId).single(),
      supabase.from("lists").select("name").eq("id", targetListId).single(),
    ]);

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

    // Log activity
    await logActivity(taskId, "moved", {
      from: sourceList?.name || "Unknown",
      to: targetList?.name || "Unknown",
    });

    // Note: No revalidatePath needed - React Query handles cache invalidation
    // and realtime subscriptions handle live updates
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

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}

export async function archiveTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get board info before updating
  const { data: task } = await supabase
    .from("tasks")
    .select("list_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({
      archived: true,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error archiving task:", error);
    return { success: false, error: error.message };
  }

  await logActivity(taskId, "updated", { archived: true });

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}

export async function unarchiveTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Get board info before updating
  const { data: task } = await supabase
    .from("tasks")
    .select("list_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase
    .from("tasks")
    .update({
      archived: false,
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error unarchiving task:", error);
    return { success: false, error: error.message };
  }

  await logActivity(taskId, "updated", { archived: false });

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}

export async function completeTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error completing task:", error);
    return { success: false, error: error.message };
  }

  await logActivity(taskId, "completed", {});

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}

export async function uncompleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      completed: false,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error uncompleting task:", error);
    return { success: false, error: error.message };
  }

  await logActivity(taskId, "uncompleted", {});

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}
