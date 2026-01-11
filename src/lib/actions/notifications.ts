"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Notification = {
  id: string;
  user_id: string;
  type: "mention" | "assignment" | "comment" | "due_date";
  title: string;
  message: string | null;
  task_id: string | null;
  workspace_id: string | null;
  board_id: string | null;
  actor_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  actor?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export async function getNotifications(limit: number = 20): Promise<Notification[]> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  if (!data) return [];

  // Fetch actor profiles separately since actor_id references auth.users, not profiles
  const actorIds = data.filter((n) => n.actor_id).map((n) => n.actor_id);
  const actorProfilesMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", actorIds);

    if (profiles) {
      profiles.forEach((profile) => {
        actorProfilesMap.set(profile.id, profile);
      });
    }
  }

  // Combine notifications with actor profiles
  return data.map((notification) => ({
    ...notification,
    actor: notification.actor_id ? (actorProfilesMap.get(notification.actor_id) || null) : null,
  })) as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }

  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    console.error("Error marking notification as read:", error);
    return { success: false };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllAsRead(): Promise<{ success: boolean }> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    console.error("Error marking all as read:", error);
    return { success: false };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    console.error("Error deleting notification:", error);
    return { success: false };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  taskId,
  workspaceId,
  boardId,
  actorId,
}: {
  userId: string;
  type: "mention" | "assignment" | "comment" | "due_date";
  title: string;
  message?: string;
  taskId?: string;
  workspaceId?: string;
  boardId?: string;
  actorId?: string;
}): Promise<{ success: boolean }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message: message || null,
      task_id: taskId || null,
      workspace_id: workspaceId || null,
      board_id: boardId || null,
      actor_id: actorId || null,
    });

  if (error) {
    console.error("Error creating notification:", error);
    return { success: false };
  }

  return { success: true };
}
