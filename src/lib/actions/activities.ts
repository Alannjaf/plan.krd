"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export type TaskActivity = {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
  profiles?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type ActivityAction =
  | "created"
  | "updated"
  | "moved"
  | "assigned"
  | "unassigned"
  | "label_added"
  | "label_removed"
  | "subtask_added"
  | "subtask_completed"
  | "subtask_deleted"
  | "attachment_added"
  | "attachment_deleted"
  | "comment_added"
  | "due_date_changed"
  | "priority_changed"
  | "description_changed"
  | "completed"
  | "uncompleted";

export async function getTaskActivities(
  taskId: string
): Promise<TaskActivity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_activities")
    .select("*, profiles(id, email, full_name, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching task activities", error, { taskId });
    return [];
  }

  return data || [];
}

export async function logActivity(
  taskId: string,
  action: ActivityAction,
  changes: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const { error } = await supabase.from("task_activities").insert({
    task_id: taskId,
    user_id: user.id,
    action,
    changes,
  });

  if (error) {
    logger.error("Error logging activity", error, { taskId, action, userId: user.id });
    return { success: false, error: error.message };
  }

  return { success: true };
}
