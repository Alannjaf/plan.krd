"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "./activities";
import { createNotification } from "./notifications";
import { extractMentions } from "@/lib/utils/mentions";
import { logger } from "@/lib/utils/logger";
import { updateCommentSchema } from "@/lib/validations/comments";
import { z } from "zod";

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
  // Skip database query if taskId is a temporary ID (optimistic update)
  if (taskId.startsWith("temp-")) {
    return [];
  }

  const supabase = await createClient();

  // Get all comments for the task
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles(id, email, full_name, avatar_url)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching comments", error, { taskId });
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

  // Log activity (non-blocking)
  logActivity(taskId, "comment_added", {}).catch((err) => {
    logger.error("Error logging activity", err, { taskId, userId: user.id });
  });

  // Process mentions asynchronously (don't block comment creation)
  const mentions = extractMentions(content);
  if (mentions.length > 0) {
    // Process mentions in background - don't await
    (async () => {
      try {
        // Get task details for notification
        const { data: task } = await supabase
          .from("tasks")
          .select("title, lists(boards(id, workspace_id))")
          .eq("id", taskId)
          .single();

        if (!task) return;

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

        // Batch profile queries - build OR conditions for all mentions
        const escapedMentions = mentions.map(m => m.replace(/%/g, "\\%").replace(/_/g, "\\_"));
        const orConditions = escapedMentions.flatMap(m => [
          `email.ilike.%${m}%`,
          `full_name.ilike.%${m}%`
        ]).join(",");

        // Single query for all mentions
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .or(orConditions);

        if (!profiles || profiles.length === 0) return;

        // Match profiles to mentions
        const allProfiles = new Map<string, { id: string; email: string | null; full_name: string | null }>();
        
        for (const profile of profiles) {
          // Check if profile matches any mention
          const matchesMention = mentions.some(mention => {
            const emailMatch = profile.email?.toLowerCase() === mention.toLowerCase() ||
              profile.email?.toLowerCase().includes(mention.toLowerCase());
            const nameMatch = profile.full_name?.toLowerCase() === mention.toLowerCase() ||
              profile.full_name?.toLowerCase().includes(mention.toLowerCase());
            return emailMatch || nameMatch;
          });
          
          if (matchesMention) {
            allProfiles.set(profile.id, profile);
          }
        }

        // Create notifications in parallel
        const notificationPromises = Array.from(allProfiles.values())
          .filter(profile => profile.id !== user.id)
          .map(profile =>
            createNotification({
              userId: profile.id,
              type: "mention",
              title: "You were mentioned in a comment",
              message: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
              taskId,
              workspaceId: board?.workspace_id,
              boardId: board?.id,
              actorId: user.id,
            })
          );

        await Promise.all(notificationPromises);
      } catch (error) {
        logger.error("Error processing mentions", error, { taskId, userId: user.id, mentionsCount: mentions.length });
        // Don't throw - mentions are non-critical
      }
    })();
  }

  return { success: true, comment: data };
}

export async function updateComment(
  commentId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Validate input
  const validation = updateCommentSchema.safeParse({ commentId, content });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0].message,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify comment exists and user owns it
  const { data: comment, error: fetchError } = await supabase
    .from("comments")
    .select("user_id, task_id")
    .eq("id", commentId)
    .single();

  if (fetchError || !comment) {
    return { success: false, error: "Comment not found" };
  }

  if (comment.user_id !== user.id) {
    return {
      success: false,
      error: "You don't have permission to edit this comment",
    };
  }

  const { error } = await supabase
    .from("comments")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) {
    logger.error("Error updating comment", error, { commentId, userId: user.id, taskId: comment.task_id });
    return { success: false, error: error.message };
  }

  // Log activity
  logActivity(comment.task_id, "description_changed", {
    commentId,
    content: content.slice(0, 100), // Truncate for activity log
  }).catch((err) => {
    logger.error("Error logging activity", err, { taskId: comment.task_id, userId: user.id });
  });

  return { success: true };
}

export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Validate UUID format
  const uuidSchema = z.string().uuid("Invalid comment ID");
  const validation = uuidSchema.safeParse(commentId);
  if (!validation.success) {
    return { success: false, error: "Invalid comment ID" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify comment exists and user owns it
  const { data: comment, error: fetchError } = await supabase
    .from("comments")
    .select("user_id, task_id")
    .eq("id", commentId)
    .single();

  if (fetchError || !comment) {
    return { success: false, error: "Comment not found" };
  }

  if (comment.user_id !== user.id) {
    return {
      success: false,
      error: "You don't have permission to delete this comment",
    };
  }

  const { error } = await supabase.from("comments").delete().eq("id", commentId);

  if (error) {
    logger.error("Error deleting comment", error, { commentId, userId: user.id, taskId: comment.task_id });
    return { success: false, error: error.message };
  }

  // Note: Activity logging for comment deletion would require a new activity type
  // For now, we skip it as the plan notes this may need schema changes

  return { success: true };
}
