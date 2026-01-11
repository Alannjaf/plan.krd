"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "./activities";
import { createNotification } from "./notifications";
import { extractMentions } from "@/lib/utils/mentions";

export type Comment = {
  id: string;
  task_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
};

export async function getComments(taskId: string): Promise<Comment[]> {
  const supabase = await createClient();

  // Get all comments for the task
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles(id, email, full_name, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  // Build threaded structure
  const commentsMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  // First pass: create all comments
  data?.forEach((comment) => {
    commentsMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree
  data?.forEach((comment) => {
    const commentWithReplies = commentsMap.get(comment.id)!;
    if (comment.parent_id) {
      const parent = commentsMap.get(comment.parent_id);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(commentWithReplies);
      }
    } else {
      rootComments.push(commentWithReplies);
    }
  });

  return rootComments;
}

export async function createComment(
  taskId: string,
  content: string,
  parentId?: string
): Promise<{ success: boolean; comment?: Comment; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      task_id: taskId,
      user_id: user.id,
      content,
      parent_id: parentId || null,
    })
    .select("*, profiles(id, email, full_name, avatar_url)")
    .single();

  if (error) {
    console.error("Error creating comment:", error);
    return { success: false, error: error.message };
  }

  // Log activity
  await logActivity(taskId, "comment_added", {});

  // Create notifications for mentions
  const mentions = extractMentions(content);
  if (mentions.length > 0) {
    // Get task details for notification
    const { data: task } = await supabase
      .from("tasks")
      .select("title, lists(boards(id, workspace_id))")
      .eq("id", taskId)
      .single();

    if (task) {
      const board = (task.lists as { boards: { id: string; workspace_id: string } })?.boards;

      // Look up mentioned users by email or full_name
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .or(mentions.map((m) => `email.ilike.${m},full_name.ilike.${m}`).join(","));

      if (profiles) {
        for (const profile of profiles) {
          if (profile.id !== user.id) {
            await createNotification({
              userId: profile.id,
              type: "mention",
              title: "You were mentioned in a comment",
              message: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
              taskId,
              workspaceId: board?.workspace_id,
              boardId: board?.id,
              actorId: user.id,
            });
          }
        }
      }
    }
  }

  return { success: true, comment: data };
}

export async function updateComment(
  commentId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("comments")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) {
    console.error("Error updating comment:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("comments").delete().eq("id", commentId);

  if (error) {
    console.error("Error deleting comment:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
