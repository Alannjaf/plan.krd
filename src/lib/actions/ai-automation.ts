"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";
import {
  suggestAssignee,
  autoAssignTask,
  detectDuplicates,
  generateReminder,
  type AssigneeSuggestion,
  type DuplicateTask,
} from "@/lib/ai/automation";
import { addAssignee } from "./assignees";

/**
 * Get assignee suggestions for a task
 */
export async function getAssigneeSuggestions(
  taskId: string
): Promise<{ success: boolean; suggestions?: AssigneeSuggestion[]; error?: string }> {
  try {
    const result = await suggestAssignee(taskId);
    return result;
  } catch (error) {
    logger.error("Error getting assignee suggestions", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Auto-assign a task based on AI suggestions
 */
export async function applyAutoAssignment(
  taskId: string,
  userId?: string
): Promise<{ success: boolean; assigned_to?: string; error?: string }> {
  const supabase = await createClient();

  try {
    let assigneeId = userId;

    // If no user specified, get AI suggestion
    if (!assigneeId) {
      const suggestionResult = await autoAssignTask(taskId);
      if (!suggestionResult.success || !suggestionResult.assigned_to) {
        return { success: false, error: "No suitable assignee found" };
      }
      assigneeId = suggestionResult.assigned_to;
    }

    // Assign the task
    const result = await addAssignee(taskId, assigneeId, true); // true = ai_suggested

    if (!result.success) {
      return { success: false, error: result.error || "Failed to assign task" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true, assigned_to: assigneeId };
  } catch (error) {
    logger.error("Error applying auto-assignment", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detect duplicates for a task or board
 */
export async function detectAndStoreDuplicates(
  boardId: string,
  taskId?: string
): Promise<{ success: boolean; duplicates?: DuplicateTask[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task title if taskId provided
    let taskTitle: string | undefined;
    if (taskId) {
      const { data: task } = await supabase
        .from("tasks")
        .select("title")
        .eq("id", taskId)
        .single();
      taskTitle = task?.title;
    }

    // Detect duplicates
    const result = await detectDuplicates(boardId, taskTitle, taskId);

    if (!result.success || !result.duplicates) {
      return result;
    }

    // Store duplicates in database
    const duplicatesToStore = result.duplicates.map((d) => ({
      task_id: d.task_id,
      duplicate_task_id: d.duplicate_task_id,
      similarity_score: d.similarity_score,
    }));

    // Delete old duplicate records for these tasks
    if (taskId) {
      await supabase
        .from("ai_duplicate_tasks")
        .delete()
        .eq("task_id", taskId)
        .is("resolved_at", null);
    }

    // Insert new duplicates
    if (duplicatesToStore.length > 0) {
      const { error: insertError } = await supabase
        .from("ai_duplicate_tasks")
        .insert(duplicatesToStore);

      if (insertError) {
        logger.error("Error storing duplicates", insertError);
        return { success: false, error: "Failed to store duplicates" };
      }
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true, duplicates: result.duplicates };
  } catch (error) {
    logger.error("Error detecting duplicates", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get stored duplicate tasks for a board
 */
export async function getDuplicateTasks(
  boardId: string
): Promise<{ success: boolean; duplicates?: DuplicateTask[]; error?: string }> {
  const supabase = await createClient();

  try {
    // Get all tasks in board
    const { data: boardTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("lists.board_id", boardId)
      .eq("archived", false);

    if (!boardTasks || boardTasks.length === 0) {
      return { success: true, duplicates: [] };
    }

    const taskIds = boardTasks.map((t) => t.id);

    // Get duplicate records
    const { data: duplicates, error } = await supabase
      .from("ai_duplicate_tasks")
      .select("*")
      .in("task_id", taskIds)
      .is("resolved_at", null)
      .order("similarity_score", { ascending: false });

    if (error) {
      logger.error("Error fetching duplicates", error);
      return { success: false, error: "Failed to fetch duplicates" };
    }

    // Get task titles
    const allTaskIds = new Set<string>();
    duplicates?.forEach((d) => {
      allTaskIds.add(d.task_id);
      allTaskIds.add(d.duplicate_task_id);
    });

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title")
      .in("id", Array.from(allTaskIds));

    const taskTitleMap = new Map(tasks?.map((t) => [t.id, t.title]) || []);

    const formattedDuplicates: DuplicateTask[] =
      duplicates?.map((d) => ({
        task_id: d.task_id,
        duplicate_task_id: d.duplicate_task_id,
        similarity_score: d.similarity_score,
        matching_fields: ["title", "description"], // Could be enhanced
        task_title: taskTitleMap.get(d.task_id) || "",
        duplicate_title: taskTitleMap.get(d.duplicate_task_id) || "",
      })) || [];

    return { success: true, duplicates: formattedDuplicates };
  } catch (error) {
    logger.error("Error getting duplicates", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolve a duplicate task record
 */
export async function resolveDuplicate(
  duplicateId: string,
  action: "merged" | "dismissed" | "kept_separate"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("ai_duplicate_tasks")
      .update({
        resolved_at: new Date().toISOString(),
        action_taken: action,
      })
      .eq("id", duplicateId);

    if (error) {
      logger.error("Error resolving duplicate", error);
      return { success: false, error: "Failed to resolve duplicate" };
    }

    revalidatePath(`/[workspaceId]/[boardId]`, "layout");
    return { success: true };
  } catch (error) {
    logger.error("Error resolving duplicate", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a reminder for a task
 */
export async function generateTaskReminder(
  taskId: string
): Promise<{ success: boolean; reminder?: string; error?: string }> {
  const supabase = await createClient();

  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        due_date,
        priority,
        task_assignees(user_id, profiles(full_name, email))
      `)
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    const today = new Date();
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const daysUntilDue = dueDate
      ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    const assignees = Array.isArray(task.task_assignees)
      ? task.task_assignees.map((ta: any) => {
          const profile = Array.isArray(ta.profiles) ? ta.profiles[0] : ta.profiles;
          return profile?.full_name || profile?.email || "Unknown";
        })
      : [];

    const context = {
      task_id: taskId,
      task_title: task.title,
      due_date: task.due_date || undefined,
      priority: task.priority || undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
      days_until_due: daysUntilDue,
    };

    const result = await generateReminder(taskId, context);
    return result;
  } catch (error) {
    logger.error("Error generating reminder", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
