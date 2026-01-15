"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceWithMeta = Workspace & {
  member_count: number;
  current_user_role: "owner" | "admin" | "member" | "viewer" | "commenter" | null;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer" | "commenter";
  joined_at: string;
  profiles?: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  current_user_role: "owner" | "admin" | "member" | "viewer" | "commenter" | null;
};

/**
 * Get lightweight workspace summaries for dashboard listing
 * Returns only essential fields for fast loading
 */
export async function getWorkspacesSummary(): Promise<WorkspaceSummary[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get workspaces with member count (minimal fields)
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, name, description, workspace_members(count)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching workspace summaries", error, { userId: user.id });
    return [];
  }

  if (!workspaces) {
    return [];
  }

  // Get user's role for each workspace
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  const membershipMap = new Map(
    memberships?.map((m) => [m.workspace_id, m.role]) || []
  );

  return workspaces.map((workspace) => {
    const memberCount = (workspace.workspace_members as { count: number }[])?.[0]?.count || 0;
    const userRole = membershipMap.get(workspace.id) || null;

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      member_count: memberCount,
      current_user_role: userRole,
    };
  });
}

export async function getWorkspaces(): Promise<WorkspaceWithMeta[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get workspaces with member count
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("*, workspace_members(count)")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching workspaces", error, { userId: user.id });
    return [];
  }

  if (!workspaces) {
    return [];
  }

  // Get user's role for each workspace
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id);

  const membershipMap = new Map(
    memberships?.map((m) => [m.workspace_id, m.role]) || []
  );

  return workspaces.map((workspace) => {
    const memberCount = (workspace.workspace_members as { count: number }[])?.[0]?.count || 0;
    const userRole = membershipMap.get(workspace.id) || null;

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      slug: workspace.slug,
      owner_id: workspace.owner_id,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
      member_count: memberCount,
      current_user_role: userRole,
    };
  });
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (error) {
    logger.error("Error fetching workspace", error, { workspaceId });
    return null;
  }

  return data;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 50) + "-" + Math.random().toString(36).substring(2, 8);
}

export async function createWorkspace(
  name: string,
  description?: string
): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const slug = generateSlug(name);

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name,
      description: description || null,
      slug,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating workspace", error, { name, userId: user.id });
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true, workspace: data };
}

export async function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId);

  if (error) {
    console.error("Error updating workspace:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/${workspaceId}`);
  return { success: true };
}

export async function deleteWorkspace(
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (error) {
    logger.error("Error deleting workspace", error, { workspaceId });
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("*, profiles(email, full_name, avatar_url)")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  if (error) {
    logger.error("Error fetching workspace members", error, { workspaceId });
    return [];
  }

  return data || [];
}

export async function removeMember(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) {
    logger.error("Error removing member", error, { workspaceId, userId });
    return { success: false, error: error.message };
  }

  revalidatePath(`/${workspaceId}/settings`);
  return { success: true };
}
