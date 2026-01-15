"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import type { ReportFilters, ReportFieldSelection } from "./reports";

export type CustomReport = {
  id: string;
  workspace_id: string;
  board_id: string | null;
  name: string;
  config: {
    filters?: ReportFilters;
    fields?: ReportFieldSelection;
    layout?: any; // For future drag-and-drop layout
  };
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * Get all custom reports for a workspace
 */
export async function getCustomReports(
  workspaceId: string,
  boardId?: string
): Promise<{ success: boolean; data?: CustomReport[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    let query = supabase
      .from("custom_reports")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (boardId) {
      query = query.eq("board_id", boardId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching custom reports", error, { workspaceId, boardId });
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("Error fetching custom reports", error, { workspaceId, boardId });
    return { success: false, error: "Failed to fetch custom reports" };
  }
}

/**
 * Save a custom report
 */
export async function saveCustomReport(params: {
  workspaceId: string;
  boardId?: string;
  name: string;
  config: {
    filters?: ReportFilters;
    fields?: ReportFieldSelection;
    layout?: any;
  };
  reportId?: string; // For updates
}): Promise<{ success: boolean; data?: CustomReport; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { workspaceId, boardId, name, config, reportId } = params;

  try {
    if (reportId) {
      // Update existing report
      const { data, error } = await supabase
        .from("custom_reports")
        .update({
          name,
          config,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId)
        .select()
        .single();

      if (error) {
        logger.error("Error updating custom report", error, params);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } else {
      // Create new report
      const { data, error } = await supabase
        .from("custom_reports")
        .insert({
          workspace_id: workspaceId,
          board_id: boardId || null,
          name,
          config,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating custom report", error, params);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    }
  } catch (error) {
    logger.error("Error saving custom report", error, params);
    return { success: false, error: "Failed to save custom report" };
  }
}

/**
 * Delete a custom report
 */
export async function deleteCustomReport(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const { error } = await supabase.from("custom_reports").delete().eq("id", reportId);

    if (error) {
      logger.error("Error deleting custom report", error, { reportId });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("Error deleting custom report", error, { reportId });
    return { success: false, error: "Failed to delete custom report" };
  }
}
