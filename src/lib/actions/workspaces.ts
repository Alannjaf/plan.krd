"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
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

export async function getWorkspaces(): Promise<Workspace[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }

  return data || [];
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (error) {
    console.error("Error fetching workspace:", error);
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
    console.error("Error creating workspace:", error);
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
    console.error("Error deleting workspace:", error);
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
    console.error("Error fetching workspace members:", error);
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
    console.error("Error removing member:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/${workspaceId}/settings`);
  return { success: true };
}
