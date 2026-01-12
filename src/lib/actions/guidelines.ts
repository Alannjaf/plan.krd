"use server";

import { createClient } from "@/lib/supabase/server";
import type { BoardGuidelines } from "./ai";

/**
 * Get AI guidelines for a board
 */
export async function getBoardGuidelines(
  boardId: string
): Promise<{ success: boolean; guidelines?: BoardGuidelines; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("board_ai_guidelines")
    .select("guidelines, last_updated, version")
    .eq("board_id", boardId)
    .single();

  if (error) {
    // If not found, return success: false but no error (guidelines just don't exist yet)
    if (error.code === "PGRST116") {
      return { success: false };
    }
    console.error("Error fetching board guidelines:", error);
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false };
  }

  // Check if guidelines are stale (older than 7 days)
  const lastUpdated = new Date(data.last_updated);
  const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
  const isStale = daysSinceUpdate > 7;

  return {
    success: true,
    guidelines: data.guidelines as BoardGuidelines,
  };
}

/**
 * Force a full recomputation of guidelines for a board
 */
export async function refreshBoardGuidelines(
  boardId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Call the database function to update guidelines
  const { error } = await supabase.rpc("update_board_guidelines", {
    p_board_id: boardId,
  });

  if (error) {
    console.error("Error refreshing board guidelines:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get guidelines or compute on-demand if missing
 */
export async function getGuidelinesOrCompute(
  boardId: string
): Promise<{ success: boolean; guidelines?: BoardGuidelines; error?: string }> {
  // First try to get existing guidelines
  const result = await getBoardGuidelines(boardId);

  if (result.success && result.guidelines) {
    return result;
  }

  // If guidelines don't exist or are stale, compute them
  const refreshResult = await refreshBoardGuidelines(boardId);

  if (!refreshResult.success) {
    return { success: false, error: refreshResult.error };
  }

  // Try to get the newly computed guidelines
  return await getBoardGuidelines(boardId);
}
