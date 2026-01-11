"use server";

import { createClient } from "@/lib/supabase/server";

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
  | "description_changed";

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
    console.error("Error fetching task activities:", error);
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
    console.error("Error logging activity:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export function getActivityMessage(
  activity: TaskActivity,
  userName: string
): string {
  const changes = activity.changes;

  switch (activity.action) {
    case "created":
      return `${userName} created this task`;
    case "updated":
      return `${userName} updated the task`;
    case "moved":
      return `${userName} moved the task from "${changes.from}" to "${changes.to}"`;
    case "assigned":
      return `${userName} assigned ${changes.assignee} to this task`;
    case "unassigned":
      return `${userName} removed ${changes.assignee} from this task`;
    case "label_added":
      return `${userName} added label "${changes.label}"`;
    case "label_removed":
      return `${userName} removed label "${changes.label}"`;
    case "subtask_added":
      return `${userName} added subtask "${changes.title}"`;
    case "subtask_completed":
      return `${userName} completed subtask "${changes.title}"`;
    case "subtask_deleted":
      return `${userName} deleted subtask "${changes.title}"`;
    case "attachment_added":
      return `${userName} attached "${changes.fileName}"`;
    case "attachment_deleted":
      return `${userName} removed attachment "${changes.fileName}"`;
    case "comment_added":
      return `${userName} added a comment`;
    case "due_date_changed":
      if (changes.from && changes.to) {
        return `${userName} changed due date from ${changes.from} to ${changes.to}`;
      } else if (changes.to) {
        return `${userName} set due date to ${changes.to}`;
      } else {
        return `${userName} removed due date`;
      }
    case "priority_changed":
      return `${userName} changed priority from "${changes.from}" to "${changes.to}"`;
    case "description_changed":
      return `${userName} updated the description`;
    default:
      return `${userName} made changes`;
  }
}
