"use server";

import { createClient } from "@/lib/supabase/server";

export type Assignee = {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export async function getTaskAssignees(taskId: string): Promise<Assignee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_assignees")
    .select("*, profiles(id, email, full_name, avatar_url)")
    .eq("task_id", taskId);

  if (error) {
    console.error("Error fetching task assignees:", error);
    return [];
  }

  return data || [];
}

export async function addAssignee(
  taskId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("task_assignees").insert({
    task_id: taskId,
    user_id: userId,
    assigned_by: user?.id,
  });

  if (error) {
    console.error("Error adding assignee:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function removeAssignee(
  taskId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error removing assignee:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getWorkspaceMembers(workspaceId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, profiles(id, email, full_name, avatar_url)")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("Error fetching workspace members:", error);
    return [];
  }

  return data || [];
}
