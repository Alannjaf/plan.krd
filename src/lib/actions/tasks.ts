"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activities";
import { logger } from "@/lib/utils/logger";

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
  share_token: string | null;
  share_enabled: boolean;
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
    logger.error("Error fetching task", error, { taskId, boardId });
    return null;
  }

  // Get counts for attachments and comments in parallel
  // Using head: true and count: "exact" for efficient counting without fetching data
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
    logger.error("Error fetching tasks", error, { listId });
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
    logger.error("Error fetching tasks by board", error, { boardId });
    return [];
  }

  return data || [];
}

export type PaginationParams = {
  limit?: number;
  offset?: number;
  cursor?: string; // For cursor-based pagination
};

export type PaginatedTasksResult = {
  tasks: TaskWithRelations[];
  total: number;
  hasMore: boolean;
  nextCursor?: string; // For cursor-based pagination
};

export type TaskSummary = {
  id: string;
  title: string;
  list_id: string;
  position: number;
  priority: "low" | "medium" | "high" | "urgent" | null;
  due_date: string | null;
  completed: boolean;
  archived: boolean;
  attachments_count: number;
  comments_count: number;
  assignees_count: number;
  labels_count: number;
  // No nested relations (assignees, labels, subtasks)
};

export type PaginatedTaskSummaryResult = {
  tasks: TaskSummary[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
};

// Function overloads for type safety
export async function getTasksWithRelations(
  boardId: string,
  includeArchived?: boolean,
  pagination?: PaginationParams
): Promise<PaginatedTasksResult>;
export async function getTasksWithRelations(
  boardId: string,
  includeArchived?: boolean,
  pagination?: undefined
): Promise<TaskWithRelations[]>;
export async function getTasksWithRelations(
  boardId: string,
  includeArchived = false,
  pagination?: PaginationParams
): Promise<TaskWithRelations[] | PaginatedTasksResult> {
  const supabase = await createClient();
  const limit = pagination?.limit ?? 100; // Default to 100, no limit if not specified
  const offset = pagination?.offset ?? 0;

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
    `, { count: pagination ? "exact" : undefined })
    .eq("lists.board_id", boardId)
    .order("position", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  // Apply pagination if specified
  if (pagination) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: tasks, error: tasksError, count } = await query;

  if (tasksError) {
    logger.error("Error fetching tasks with relations", tasksError, { boardId, includeArchived, pagination });
    return pagination ? { tasks: [], total: 0, hasMore: false } : [];
  }

  if (!tasks || tasks.length === 0) {
    return pagination ? { tasks: [], total: count ?? 0, hasMore: false } : [];
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

  // Type for raw Supabase task response with nested relations
  type RawTaskAssignee = {
    id: string;
    user_id: string;
    profiles: {
      id: string;
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  };

  type RawTaskLabel = {
    id: string;
    label_id: string;
    labels: {
      id: string;
      name: string;
      color: string;
    } | null;
  };

  type RawSubtask = {
    id: string;
    title: string;
    completed: boolean;
    position: number;
    due_date: string | null;
    assignee_id: string | null;
    assignee: {
      id: string;
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  };

  type RawTaskResponse = Task & {
    assignees: RawTaskAssignee[] | null;
    labels: RawTaskLabel[] | null;
    subtasks: RawSubtask[] | null;
  };

  // Combine tasks with their relations
  const transformedTasks = (tasks as RawTaskResponse[]).map((task) => ({
    ...task,
    assignees: (task.assignees || []).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      profiles: a.profiles || {
        id: "",
        email: null,
        full_name: null,
        avatar_url: null,
      },
    })),
    labels: (task.labels || []).map((l) => ({
      id: l.id,
      label_id: l.label_id,
      labels: l.labels || {
        id: "",
        name: "",
        color: "",
      },
    })),
    subtasks: (task.subtasks || []).sort((a, b) => a.position - b.position).map((s) => ({
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

  // Return paginated result if pagination was requested
  if (pagination) {
    const total = count ?? 0;
    return {
      tasks: transformedTasks,
      total,
      hasMore: offset + transformedTasks.length < total,
    } as PaginatedTasksResult;
  }

  // Return array for backward compatibility
  return transformedTasks;
}

/**
 * Get lightweight task summaries for a specific list (no nested relations)
 * Optimized for fast loading of kanban columns
 */
export async function getTasksSummaryByList(
  listId: string,
  includeArchived = false,
  pagination?: PaginationParams
): Promise<PaginatedTaskSummaryResult> {
  const supabase = await createClient();
  const limit = pagination?.limit ?? 20; // Default to 20 tasks per list
  const offset = pagination?.offset ?? 0;

  // Build base query
  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("list_id", listId)
    .order("position", { ascending: true });

  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  // Apply cursor-based pagination if cursor is provided
  if (pagination?.cursor) {
    // Cursor is the position of the last task from previous page
    query = query.gt("position", parseInt(pagination.cursor));
  }

  // Apply limit
  query = query.limit(limit + 1); // Fetch one extra to determine hasMore

  const { data: tasks, error, count } = await query;

  if (error) {
    logger.error("Error fetching task summaries by list", error, { listId, includeArchived, pagination });
    return { tasks: [], total: 0, hasMore: false };
  }

  if (!tasks || tasks.length === 0) {
    return { tasks: [], total: count ?? 0, hasMore: false };
  }

  // Determine if there are more tasks
  const hasMore = tasks.length > limit;
  const tasksToReturn = hasMore ? tasks.slice(0, limit) : tasks;

  // Get task IDs for count queries
  const taskIds = tasksToReturn.map((t) => t.id);

  // Fetch counts in parallel (efficient batch queries)
  const [attachmentsResult, commentsResult, assigneesResult, labelsResult] = await Promise.all([
    supabase
      .from("attachments")
      .select("task_id")
      .in("task_id", taskIds),
    supabase
      .from("comments")
      .select("task_id")
      .in("task_id", taskIds),
    supabase
      .from("task_assignees")
      .select("task_id")
      .in("task_id", taskIds),
    supabase
      .from("task_labels")
      .select("task_id")
      .in("task_id", taskIds),
  ]);

  // Count by task_id
  const attachmentsCountByTask = new Map<string, number>();
  const commentsCountByTask = new Map<string, number>();
  const assigneesCountByTask = new Map<string, number>();
  const labelsCountByTask = new Map<string, number>();

  attachmentsResult.data?.forEach((a) => {
    const count = attachmentsCountByTask.get(a.task_id) || 0;
    attachmentsCountByTask.set(a.task_id, count + 1);
  });

  commentsResult.data?.forEach((c) => {
    const count = commentsCountByTask.get(c.task_id) || 0;
    commentsCountByTask.set(c.task_id, count + 1);
  });

  assigneesResult.data?.forEach((a) => {
    const count = assigneesCountByTask.get(a.task_id) || 0;
    assigneesCountByTask.set(a.task_id, count + 1);
  });

  labelsResult.data?.forEach((l) => {
    const count = labelsCountByTask.get(l.task_id) || 0;
    labelsCountByTask.set(l.task_id, count + 1);
  });

  // Transform to TaskSummary
  const summaries: TaskSummary[] = tasksToReturn.map((task) => ({
    id: task.id,
    title: task.title,
    list_id: task.list_id,
    position: task.position,
    priority: task.priority,
    due_date: task.due_date,
    completed: task.completed,
    archived: task.archived,
    attachments_count: attachmentsCountByTask.get(task.id) || 0,
    comments_count: commentsCountByTask.get(task.id) || 0,
    assignees_count: assigneesCountByTask.get(task.id) || 0,
    labels_count: labelsCountByTask.get(task.id) || 0,
  }));

  // Calculate next cursor (position of last task)
  const nextCursor = hasMore && summaries.length > 0
    ? summaries[summaries.length - 1].position.toString()
    : undefined;

  return {
    tasks: summaries,
    total: count ?? 0,
    hasMore,
    nextCursor,
  };
}

/**
 * Get task summary by ID (lightweight lookup)
 */
export async function getTaskSummary(taskId: string): Promise<TaskSummary | null> {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error || !task) {
    logger.error("Error fetching task summary", error, { taskId });
    return null;
  }

  // Get counts
  const [attachmentsResult, commentsResult, assigneesResult, labelsResult] = await Promise.all([
    supabase.from("attachments").select("id").eq("task_id", taskId),
    supabase.from("comments").select("id").eq("task_id", taskId),
    supabase.from("task_assignees").select("id").eq("task_id", taskId),
    supabase.from("task_labels").select("id").eq("task_id", taskId),
  ]);

  return {
    id: task.id,
    title: task.title,
    list_id: task.list_id,
    position: task.position,
    priority: task.priority,
    due_date: task.due_date,
    completed: task.completed,
    archived: task.archived,
    attachments_count: attachmentsResult.data?.length || 0,
    comments_count: commentsResult.data?.length || 0,
    assignees_count: assigneesResult.data?.length || 0,
    labels_count: labelsResult.data?.length || 0,
  };
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
    logger.error("Error creating task", error, { listId, title, userId: user?.id });
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
    logger.error("Error updating task", error, { taskId, updates });
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
    logger.error("Error deleting task", error, { taskId });
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

    // Use specific RPC for reordering within list (if one existed) or just use detailed steps
    // For Trello-like reorder in same list: 
    // If moving DOWN (0 -> 5): Items 1-5 shift UP (-1). Task becomes 5.
    // If moving UP (5 -> 0): Items 0-4 shift DOWN (+1). Task becomes 0.
    if (newPosition > oldPosition) {
      // Moving down: 
      // 1. Shift items (oldPos+1 to newPos) UP (-1)
      // 2. Update task to newPos

      const { error: shiftError } = await supabase.rpc("decrement_positions_in_range", {
        p_list_id: sourceListId,
        p_start_pos: oldPosition + 1,
        p_end_pos: newPosition
      });

      if (shiftError) return { success: false, error: shiftError.message };

    } else {
      // Moving up:
      // 1. Shift items (newPos to oldPos-1) DOWN (+1)
      // 2. Update task to newPos

      const { error: shiftError } = await supabase.rpc("increment_positions_in_range", {
        p_list_id: sourceListId,
        p_start_pos: newPosition,
        p_end_pos: oldPosition - 1
      });

      if (shiftError) return { success: false, error: shiftError.message };
    }

    // Finally update the moved task
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ position: newPosition })
      .eq("id", taskId);

    if (updateError) return { success: false, error: updateError.message };

  } else {
    // Moving to a different list
    // Get list names for activity log
    const [{ data: sourceList }, { data: targetList }] = await Promise.all([
      supabase.from("lists").select("name").eq("id", sourceListId).single(),
      supabase.from("lists").select("name").eq("id", targetListId).single(),
    ]);

    // 1. Shift items in Source list UP to close gap (oldPos + 1 to infinity)
    const { error: sourceError } = await supabase.rpc("decrement_positions_after", {
      p_list_id: sourceListId,
      p_position: oldPosition,
    });

    if (sourceError) return { success: false, error: sourceError.message };

    // 2. Shift items in Target list DOWN to make space (newPos to infinity)
    const { error: targetError } = await supabase.rpc("increment_positions_starting_at", {
      p_list_id: targetListId,
      p_position: newPosition,
    });

    if (targetError) return { success: false, error: targetError.message };

    // 3. Move the task
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
  }

  return { success: true };
}

export async function reorderTasksInList(
  listId: string,
  taskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Use the bulk reorder RPC
  const { error } = await supabase.rpc("reorder_tasks_bulk", {
    p_list_id: listId,
    p_task_ids: taskIds
  });

  if (error) {
    logger.error("Error reordering tasks", error, { listId, taskIdsCount: taskIds.length });
    return { success: false, error: error.message };
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
    logger.error("Error archiving task", error, { taskId });
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
    logger.error("Error unarchiving task", error, { taskId });
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
    logger.error("Error uncompleting task", error, { taskId });
    return { success: false, error: error.message };
  }

  await logActivity(taskId, "uncompleted", {});

  // Note: No revalidatePath needed - React Query handles cache invalidation
  // and realtime subscriptions handle live updates

  return { success: true };
}

/**
 * Generate a share token for a task to enable authenticated sharing
 */
export async function generateTaskShareToken(
  taskId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify task exists and user has access (by checking if task exists and user can see it)
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return { success: false, error: "Task not found" };
  }

  // Generate a new UUID token
  const shareToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      share_token: shareToken,
      share_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select("share_token")
    .single();

  if (error) {
    logger.error("Error generating task share token", error, { taskId });
    return { success: false, error: error.message };
  }

  return { success: true, token: data.share_token };
}

/**
 * Revoke task sharing by removing the share token
 */
export async function revokeTaskShareToken(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify task exists
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return { success: false, error: "Task not found" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      share_token: null,
      share_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    logger.error("Error revoking task share token", error, { taskId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if a task has sharing enabled
 */
export async function isTaskShareEnabled(
  taskId: string
): Promise<{ success: boolean; isShared?: boolean; token?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("share_enabled, share_token")
    .eq("id", taskId)
    .single();

  if (error) {
    logger.error("Error checking task share status", error, { taskId });
    return { success: false, error: error.message };
  }

  const isShared = data.share_enabled && data.share_token !== null;

  return { success: true, isShared, token: data.share_token || undefined };
}

/**
 * Get task by share token (requires authentication)
 */
export async function getTaskByShareToken(
  token: string
): Promise<{ success: boolean; task?: TaskWithRelations; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Find task by share token
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, share_enabled")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .single();

  if (error || !task) {
    logger.error("Error fetching task by share token", error, { token });
    return { success: false, error: "Task not found or sharing is disabled" };
  }

  // Get full task with relations
  const fullTask = await getTask(task.id);

  if (!fullTask) {
    return { success: false, error: "Task not found" };
  }

  return { success: true, task: fullTask };
}
