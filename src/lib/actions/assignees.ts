"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "./notifications";
import { logger } from "@/lib/utils/logger";

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
    .select("*, profiles:profiles!task_assignees_user_id_fkey(id, email, full_name, avatar_url)")
    .eq("task_id", taskId);

  if (error) {
    logger.error("Error fetching task assignees", error, { taskId });
    return [];
  }

  return data || [];
}

export async function addAssignee(
  taskId: string,
  userId: string,
  aiSuggested: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("task_assignees").insert({
    task_id: taskId,
    user_id: userId,
    assigned_by: user?.id,
    ai_suggested: aiSuggested,
  });

  if (error) {
    logger.error("Error adding assignee", error, { taskId, userId, assignedBy: user?.id });
    return { success: false, error: error.message };
  }

  // Create notification for the assigned user (if not self-assigning)
  if (user && userId !== user.id) {
    // Get task details for notification
    const { data: task } = await supabase
      .from("tasks")
      .select("title, lists(boards(id, workspace_id))")
      .eq("id", taskId)
      .single();

    if (task) {
      // Handle lists - Supabase may return as array or single object
      const listsData = task.lists as unknown;
      let board: { id: string; workspace_id: string } | undefined;
      
      if (Array.isArray(listsData)) {
        const firstList = listsData[0] as { boards: { id: string; workspace_id: string } } | undefined;
        board = firstList?.boards;
      } else if (listsData && typeof listsData === 'object') {
        const listObj = listsData as { boards: { id: string; workspace_id: string } | { id: string; workspace_id: string }[] };
        board = Array.isArray(listObj.boards) ? listObj.boards[0] : listObj.boards;
      }
      await createNotification({
        userId,
        type: "assignment",
        title: "You were assigned to a task",
        message: task.title,
        taskId,
        workspaceId: board?.workspace_id,
        boardId: board?.id,
        actorId: user.id,
      });
    }
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
    logger.error("Error removing assignee", error, { taskId, userId });
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
    logger.error("Error fetching workspace members", error, { workspaceId });
    return [];
  }

  return data || [];
}
